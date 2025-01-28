'use client';

import { useState, useEffect } from 'react';
import { Container } from '@/lib/docker/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal } from '@/components/ui/terminal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ContainerDetailsProps {
  containerId: string;
  onClose: () => void;
}

interface ContainerStats {
  cpu_usage: number;
  memory_usage: number;
  memory_limit: number;
  timestamp: number;
}

export function ContainerDetails({ containerId, onClose }: ContainerDetailsProps) {
  const [container, setContainer] = useState<Container | null>(null);
  const [stats, setStats] = useState<ContainerStats[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContainerDetails = async () => {
      try {
        const response = await fetch(`/api/containers/${containerId}`);
        if (!response.ok) throw new Error('Failed to fetch container details');
        const data = await response.json();
        setContainer(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/containers/${containerId}/stats`);
        if (!response.ok) throw new Error('Failed to fetch container stats');
        const data = await response.json();
        setStats(prev => [...prev, {
          cpu_usage: data.cpu_percentage,
          memory_usage: data.memory_usage,
          memory_limit: data.memory_limit,
          timestamp: Date.now(),
        }].slice(-30)); // Keep last 30 data points
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/containers/${containerId}/logs`);
        if (!response.ok) throw new Error('Failed to fetch container logs');
        const data = await response.json();
        setLogs(data.logs);
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    };

    fetchContainerDetails();
    const statsInterval = setInterval(fetchStats, 2000);
    const logsInterval = setInterval(fetchLogs, 5000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(logsInterval);
    };
  }, [containerId]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="p-4">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{container.Names[0].replace(/^\//, '')}</h2>
          <p className="text-sm text-muted-foreground">{container.Id.substring(0, 12)}</p>
        </div>
        <StatusBadge status={container.State} className="text-lg" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Image</dt>
                    <dd className="text-sm">{container.Image}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Créé le</dt>
                    <dd className="text-sm">
                      {new Date(container.Created * 1000).toLocaleString('fr-FR')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Ports</dt>
                    <dd className="text-sm">
                      {container.Ports?.length
                        ? container.Ports.map(
                            (port) => `${port.PublicPort}:${port.PrivatePort}`
                          ).join(', ')
                        : 'Aucun port exposé'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ressources</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">CPU</p>
                      <p className="text-2xl font-bold">
                        {stats[stats.length - 1].cpu_usage.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Mémoire</p>
                      <p className="text-2xl font-bold">
                        {Math.round(stats[stats.length - 1].memory_usage / 1024 / 1024)} MB
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Utilisation des ressources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(timestamp) =>
                        new Date(timestamp).toLocaleTimeString()
                      }
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(timestamp) =>
                        new Date(timestamp).toLocaleTimeString()
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="cpu_usage"
                      name="CPU (%)"
                      stroke="#2563eb"
                    />
                    <Line
                      type="monotone"
                      dataKey="memory_usage"
                      name="Mémoire (MB)"
                      stroke="#16a34a"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Logs du conteneur</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                <Terminal logs={logs} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Volumes</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  {container.Mounts?.map((mount, index) => (
                    <div key={index}>
                      <dt className="text-sm font-medium text-muted-foreground">
                        {mount.Destination}
                      </dt>
                      <dd className="text-sm">{mount.Source}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Réseau</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  {Object.entries(container.NetworkSettings?.Networks || {}).map(
                    ([network, config]) => (
                      <div key={network}>
                        <dt className="text-sm font-medium text-muted-foreground">
                          {network}
                        </dt>
                        <dd className="text-sm">
                          IP: {config.IPAddress}
                          <br />
                          Gateway: {config.Gateway}
                        </dd>
                      </div>
                    )
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
