'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Network, 
  Download,
  AlertTriangle 
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { toast } from 'sonner';

interface ResourceThresholds {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

interface SystemMetrics {
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export default function ResourceMonitoring() {
  const [metrics, setMetrics] = useState<SystemMetrics[]>([]);
  const [thresholds, setThresholds] = useState<ResourceThresholds>({
    cpu: 80,
    memory: 80,
    disk: 90,
    network: 1000
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/admin/metrics');
        if (response.ok) {
          const data = await response.json();
          setMetrics(prev => {
            const newMetrics = [...prev, {
              timestamp: Date.now(),
              ...data
            }].slice(-30); // Garde les 30 derniers points
            
            // Vérification des seuils
            if (showAlerts) {
              if (data.cpu > thresholds.cpu) {
                toast.warning(`Utilisation CPU élevée: ${data.cpu}%`);
              }
              if (data.memory > thresholds.memory) {
                toast.warning(`Utilisation mémoire élevée: ${data.memory}%`);
              }
              if (data.disk > thresholds.disk) {
                toast.warning(`Espace disque critique: ${data.disk}%`);
              }
            }
            
            return newMetrics;
          });
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des métriques:', error);
      }
    };

    fetchMetrics();
    if (autoRefresh) {
      interval = setInterval(fetchMetrics, 5000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh, thresholds, showAlerts]);

  const handleExportData = () => {
    const csvContent = [
      ['Timestamp', 'CPU (%)', 'Mémoire (%)', 'Disque (%)', 'Réseau (MB/s)'],
      ...metrics.map(m => [
        new Date(m.timestamp).toISOString(),
        m.cpu.toFixed(2),
        m.memory.toFixed(2),
        m.disk.toFixed(2),
        (m.network / 1024 / 1024).toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-metrics-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Monitoring des ressources</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label>Actualisation auto</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={showAlerts}
              onCheckedChange={setShowAlerts}
            />
            <Label>Alertes</Label>
          </div>
          <Button onClick={handleExportData} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.length > 0 ? `${metrics[metrics.length - 1].cpu.toFixed(1)}%` : '0%'}
            </div>
            <div className="mt-4">
              <Label>Seuil d'alerte</Label>
              <Input
                type="number"
                value={thresholds.cpu}
                onChange={(e) => setThresholds({ ...thresholds, cpu: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mémoire</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.length > 0 ? `${metrics[metrics.length - 1].memory.toFixed(1)}%` : '0%'}
            </div>
            <div className="mt-4">
              <Label>Seuil d'alerte</Label>
              <Input
                type="number"
                value={thresholds.memory}
                onChange={(e) => setThresholds({ ...thresholds, memory: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disque</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.length > 0 ? `${metrics[metrics.length - 1].disk.toFixed(1)}%` : '0%'}
            </div>
            <div className="mt-4">
              <Label>Seuil d'alerte</Label>
              <Input
                type="number"
                value={thresholds.disk}
                onChange={(e) => setThresholds({ ...thresholds, disk: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Réseau</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.length > 0 
                ? `${(metrics[metrics.length - 1].network / 1024 / 1024).toFixed(1)} MB/s` 
                : '0 MB/s'}
            </div>
            <div className="mt-4">
              <Label>Seuil d'alerte (MB/s)</Label>
              <Input
                type="number"
                value={thresholds.network}
                onChange={(e) => setThresholds({ ...thresholds, network: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des performances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(2)}%`]}
                />
                <Line 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#8884d8" 
                  name="CPU"
                />
                <Line 
                  type="monotone" 
                  dataKey="memory" 
                  stroke="#82ca9d" 
                  name="Mémoire"
                />
                <Line 
                  type="monotone" 
                  dataKey="disk" 
                  stroke="#ffc658" 
                  name="Disque"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
