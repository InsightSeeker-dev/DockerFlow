'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Cpu, Database, HardDrive, Layers, Plus, Terminal, Activity } from 'lucide-react';
import { Container } from '@/types/docker';
import { SystemStats } from '@/types/system';
import { toast } from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateContainerDialog } from '@/components/dashboard/CreateContainerDialog';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [containers, setContainers] = useState<Container[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (session) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchData = async () => {
    try {
      const [containersRes, statsRes] = await Promise.all([
        fetch('/api/containers'),
        fetch('/api/stats')
      ]);

      if (!containersRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [containersData, statsData] = await Promise.all([
        containersRes.json(),
        statsRes.json()
      ]);

      setContainers(containersData.containers || []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to fetch data');
    }
  };

  const handleContainerAction = async (containerId: string, action: 'start' | 'stop' | 'remove') => {
    try {
      const response = await fetch('/api/containers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, containerId }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to perform action');
      
      toast.success(`Container ${action}ed successfully`);
      fetchData();
    } catch (error) {
      console.error('Container action error:', error);
      toast.error(`Failed to ${action} container`);
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <p className="text-center text-gray-400">Please sign in to access the dashboard.</p>
        </Card>
      </div>
    );
  }

  const stats_items = [
    {
      title: 'CPU Usage',
      value: stats?.cpuUsage ? `${stats.cpuUsage.toFixed(1)}%` : '0%',
      icon: <Cpu className="h-5 w-5 text-blue-500" />,
      color: 'bg-blue-500/10 text-blue-500'
    },
    {
      title: 'Memory Usage',
      value: stats?.memoryUsage ? `${Math.round(stats.memoryUsage.used / 1024 / 1024)}MB` : '0MB',
      icon: <Database className="h-5 w-5 text-purple-500" />,
      color: 'bg-purple-500/10 text-purple-500'
    },
    {
      title: 'Disk Usage',
      value: stats?.diskUsage ? `${Math.round(stats.diskUsage.used / 1024 / 1024)}GB` : '0GB',
      icon: <HardDrive className="h-5 w-5 text-green-500" />,
      color: 'bg-green-500/10 text-green-500'
    },
    {
      title: 'Containers',
      value: `${stats?.containersRunning || 0}/${stats?.containers || 0}`,
      icon: <Layers className="h-5 w-5 text-orange-500" />,
      color: 'bg-orange-500/10 text-orange-500'
    }
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Container
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats_items.map((item, index) => (
          <Card key={index} className="p-4 bg-black/40 backdrop-blur-sm border-gray-800/50">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-xl ${item.color}`}>
                {item.icon}
              </div>
              <div>
                <p className="text-sm text-gray-400">{item.title}</p>
                <p className="text-2xl font-semibold text-white">{item.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Containers List */}
      <Card className="bg-black/40 backdrop-blur-sm border-gray-800/50">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Containers</h2>
        </div>
        <div className="p-6">
          <div className="grid gap-4">
            {containers.map((container) => (
              <Card key={container.Id} className="p-4 bg-gray-900/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{container.Names[0].slice(1)}</h3>
                    <p className="text-sm text-gray-400">{container.Image}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleContainerAction(container.Id, container.State === 'running' ? 'stop' : 'start')}
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      {container.State === 'running' ? 'Stop' : 'Start'}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Terminal className="h-4 w-4 mr-2" />
                      Terminal
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex items-center space-x-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    container.State === 'running'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {container.State}
                  </span>
                  {container.Ports.map((port) => (
                    <span
                      key={`${port.PrivatePort}-${port.PublicPort}`}
                      className="px-2 py-1 rounded-full text-xs bg-gray-800 text-gray-300"
                    >
                      Port: {port.PrivatePort}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>

      {/* Create Container Dialog */}
      <CreateContainerDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={fetchData}
      />
    </div>
  );
}