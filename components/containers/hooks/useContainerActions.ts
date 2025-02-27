import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

type ContainerAction = 'start' | 'stop' | 'restart' | 'delete' | 'access';

interface UseContainerActionsProps {
  onSuccess?: () => void;
}

export const useContainerActions = ({ onSuccess }: UseContainerActionsProps = {}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAction = async (containerId: string, action: ContainerAction) => {
    if (action === 'delete' && !window.confirm('Are you sure you want to delete this container?')) {
      return;
    }

    if (action === 'access') {
      // Récupérer les informations du conteneur pour obtenir le port exposé
      const response = await fetch(`/api/containers/${containerId}/info`);
      if (!response.ok) {
        throw new Error('Failed to get container information');
      }
      const containerInfo = await response.json();
      
      // Ouvrir l'interface web dans un nouvel onglet
      if (containerInfo.WebPort) {
        window.open(`http://localhost:${containerInfo.WebPort}`, '_blank');
        return;
      } else {
        throw new Error('No web interface available for this container');
      }
    }

    try {
      setActionLoading(containerId);
      const response = await fetch(`/api/containers/${containerId}/${action}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${action} container`);
      }

      toast({
        title: 'Success',
        description: `Container ${action}ed successfully`,
      });

      onSuccess?.();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${action} container`,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return {
    actionLoading,
    handleAction,
  };
};
