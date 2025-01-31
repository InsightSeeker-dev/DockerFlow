'use client';

import { useState } from 'react';
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useMetrics } from "@/hooks/useMetrics";
import { useContainers } from "@/hooks/useContainers";
import { Cpu, Database, HardDrive, Activity, Plus } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from '@/components/ui/button';
import { ContainerList } from '@/components/containers/container-list';
import { ContainerCreation } from '@/components/containers/container-creation';

export default function Dashboard() {
  const { metrics, loading: metricsLoading, error: metricsError } = useMetrics();
  const { containers, isLoading: containersLoading, error: containersError, refresh: refreshContainers } = useContainers();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    refreshContainers();
  };

  if (metricsError || containersError) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-red-800">
            {metricsError && `Error loading metrics: ${metricsError}`}
            {containersError && `Error loading containers: ${containersError}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground">Utilisateur</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau conteneur
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[125px] w-full" />
            </div>
          ))
        ) : (
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
        <h2 className="text-2xl font-semibold">Conteneurs</h2>
        <ContainerList
          containers={containers}
          isLoading={containersLoading}
          error={containersError}
          onRefresh={refreshContainers}
        />
      </div>

      {/* Dialog de création de conteneur */}
      <ContainerCreation
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
