import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContainerStats } from '@/lib/monitoring';
import { SystemStats } from '@/types/system';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const MAX_DATA_POINTS = 20;

interface ResourceMonitoringProps {
  containerId?: string;
}

interface ChartDataPoint {
  timestamp: number;
  value: number;
}

const ResourceMonitoring: React.FC<ResourceMonitoringProps> = ({ containerId }) => {
  const [cpuData, setCpuData] = useState<ChartDataPoint[]>([]);
  const [memoryData, setMemoryData] = useState<ChartDataPoint[]>([]);
  const [networkData, setNetworkData] = useState<ChartDataPoint[]>([]);
  const [currentStats, setCurrentStats] = useState<ContainerStats | SystemStats | null>(null);

  useEffect(() => {
    let socket: WebSocket;
    
    try {
      socket = new WebSocket(
        `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/monitoring`
      );

      socket.onopen = () => {
        console.log('WebSocket connection established');
      };

      socket.onmessage = (event) => {
        const stats = JSON.parse(event.data);
        const timestamp = Date.now();

        setCurrentStats(stats);

        // Mettre à jour les données CPU
        setCpuData(prev => {
          const newData = [...prev, { timestamp, value: stats.cpuUsage || stats.totalCpuUsage }];
          return newData.slice(-MAX_DATA_POINTS);
        });

        // Mettre à jour les données mémoire
        setMemoryData(prev => {
          const newData = [...prev, {
            timestamp,
            value: stats.memoryUsage
              ? (stats.memoryUsage / stats.memoryLimit) * 100
              : (stats.totalMemoryUsage / stats.totalMemory) * 100
          }];
          return newData.slice(-MAX_DATA_POINTS);
        });

        // Mettre à jour les données réseau
        if ('networkRx' in stats) {
          setNetworkData(prev => {
            const newData = [...prev, {
              timestamp,
              value: stats.networkRx + stats.networkTx
            }];
            return newData.slice(-MAX_DATA_POINTS);
          });
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [containerId]);

  const createChartData = (data: ChartDataPoint[], label: string): ChartData<'line'> => ({
    labels: data.map(point => new Date(point.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label,
        data: data.map(point => point.value),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        fill: false,
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    animation: {
      duration: 0,
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${sizes[index]}`;
  };

  const isSystemStats = (stats: ContainerStats | SystemStats): stats is SystemStats => {
    return 'networkTraffic' in stats && 'cpuCount' in stats;
  };

  const getCpuUsage = (stats: ContainerStats | SystemStats): number => {
    if ('cpu_stats' in stats) {
      // ContainerStats
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      return (cpuDelta / systemDelta) * 100;
    } else {
      // SystemStats
      return stats.cpuUsage;
    }
  };

  const getMemoryUsage = (stats: ContainerStats | SystemStats): number => {
    if ('memory_stats' in stats) {
      // ContainerStats
      return (stats.memory_stats.usage / stats.memory_stats.limit) * 100;
    } else {
      // SystemStats
      return stats.memoryUsage.percentage;
    }
  };

  const getNetworkUsage = (stats: ContainerStats | SystemStats): number => {
    if (isSystemStats(stats)) {
      return stats.networkTraffic.in + stats.networkTraffic.out;
    } else {
      // ContainerStats
      const networks = stats.networks || {};
      return Object.values(networks).reduce((total, network) => {
        return total + (network.rx_bytes || 0) + (network.tx_bytes || 0);
      }, 0);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>CPU Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <Line data={createChartData(cpuData, 'CPU %')} options={chartOptions} />
          <div className="mt-2 text-center">
            Current: {currentStats ? getCpuUsage(currentStats).toFixed(1) : '0'}%
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memory Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <Line data={createChartData(memoryData, 'Memory %')} options={chartOptions} />
          <div className="mt-2 text-center">
            Current: {currentStats ? getMemoryUsage(currentStats).toFixed(1) : '0'}%
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Network I/O</CardTitle>
        </CardHeader>
        <CardContent>
          <Line
            data={createChartData(networkData, 'Network I/O')}
            options={chartOptions}
          />
          <div className="mt-2 text-center">
            Current: {formatBytes(currentStats ? getNetworkUsage(currentStats) : 0)}/s
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResourceMonitoring;
