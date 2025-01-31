'use client';

import { useState } from 'react';
import { useContainers } from '@/hooks/useContainers';
import { EmptyState } from '@/components/containers/empty-state';
import { ContainerList } from '@/components/containers/container-list';
import { ContainerCreation } from '@/components/containers/container-creation';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ContainersPage() {
  const { containers, isLoading, error, refresh } = useContainers();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    refresh();
    toast({
      title: "Conteneur créé",
      description: "Le conteneur a été créé avec succès.",
    });
  };

  const handleContainerAction = async (action: string, containerId: string) => {
    try {
      const response = await fetch(`/api/containers/${containerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform action');
      }

      refresh();
      toast({
        title: "Action réussie",
        description: `L'action ${action} a été effectuée avec succès.`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Impossible d'effectuer l'action ${action}.`,
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-red-800">Erreur: {error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Si aucun conteneur n'existe, afficher l'état vide
  if (!containers || containers.length === 0) {
    return (
      <>
        <EmptyState onCreateClick={() => setShowCreateDialog(true)} />
        <ContainerCreation
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleCreateSuccess}
        />
      </>
    );
  }

  // Sinon, afficher la table des conteneurs
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-200">Conteneurs</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            className="relative dark:border-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Créer un conteneur
          </Button>
        </div>
      </div>

      <ContainerList
        containers={containers}
        isLoading={isLoading}
        error={error}
        onRefresh={refresh}
        onStart={(id) => handleContainerAction('start', id)}
        onStop={(id) => handleContainerAction('stop', id)}
        onDelete={(id) => handleContainerAction('remove', id)}
      />

      <ContainerCreation
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
