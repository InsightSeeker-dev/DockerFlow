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
import { SystemStats, ContainerStats } from '@/lib/monitoring';

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
    const socket = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/monitoring`
    );

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

    return () => {
      socket.close();
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>CPU Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <Line data={createChartData(cpuData, 'CPU %')} options={chartOptions} />
          <div className="mt-2 text-center">
            Current: {currentStats?.cpuUsage?.toFixed(1) || 0}%
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
            Current: {((currentStats?.memoryUsage || 0) / (currentStats?.memoryLimit || 1) * 100).toFixed(1)}%
          </div>
        </CardContent>
      </Card>

      {containerId && (
        <Card>
          <CardHeader>
            <CardTitle>Network I/O</CardTitle>
          </CardHeader>
          <CardContent>
            <Line
              data={createChartData(networkData, 'Network I/O (bytes)')}
              options={{
                ...chartOptions,
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
            <div className="mt-2 text-center">
              Current: {formatBytes(currentStats?.networkIO || 0)}/s
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResourceMonitoring;
