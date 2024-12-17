'use client';

import { MetricCard } from "@/components/dashboard/MetricCard";
import { useMetrics } from "@/hooks/useMetrics";
import { Cpu, Database, HardDrive, Layers, Plus, Terminal, Activity } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from '@/components/ui/button';
import { CreateContainerDialog } from '@/components/dashboard/CreateContainerDialog';

export default function DashboardPage() {
  const { metrics, loading: metricsLoading, error } = useMetrics();

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-red-800">Error loading metrics: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground">admin</p>
        </div>
        <Button onClick={() => {}}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau conteneur
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          // Skeletons pendant le chargement
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[125px] w-full" />
            </div>
          ))
        ) : (
          // Métriques réelles
          <>
            <MetricCard
              title="CPU Usage"
              value={metrics?.cpu.usage || 0}
              trend={metrics?.cpu.trend || 0}
              icon={<Cpu className="h-4 w-4" />}
            />
            <MetricCard
              title="Memory Usage"
              value={metrics?.memory.usage || 0}
              trend={metrics?.memory.trend || 0}
              icon={<Database className="h-4 w-4" />}
            />
            <MetricCard
              title="Disk Usage"
              value={metrics?.disk.usage || 0}
              trend={metrics?.disk.trend || 0}
              icon={<HardDrive className="h-4 w-4" />}
            />
            <MetricCard
              title="Network Traffic"
              value={metrics?.network.usage || 0}
              trend={metrics?.network.trend || 0}
              icon={<Activity className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Section des conteneurs */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Conteneurs actifs</h2>
        <div className="grid gap-4">
          {/* Liste des conteneurs ici */}
        </div>
      </div>
    </div>
  );
}