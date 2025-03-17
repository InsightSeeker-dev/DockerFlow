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
    if (action === 'delete' && !window.confirm('Êtes-vous sûr de vouloir supprimer ce conteneur?')) {
      return;
    }

    try {
      setActionLoading(containerId);
      
      // Utiliser la route PATCH unifiée pour toutes les actions
      const response = await fetch(`/api/containers/${containerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action,
          // Pour l'action delete/remove, on peut ajouter l'option keepVolume
          ...(action === 'delete' && { keepVolume: false })
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Échec de l'action ${action} sur le conteneur`);
      }

      const result = await response.json();
      
      // Traitement spécial pour l'action 'access'
      if (action === 'access' && result.subdomain) {
        // Ouvrir l'interface web dans un nouvel onglet en utilisant le sous-domaine
        window.open(`https://${result.subdomain}.dockersphere.ovh`, '_blank');
      } else if (action === 'access' && result.ports) {
        // Fallback sur les ports exposés si pas de sous-domaine
        const port = Object.keys(result.ports)[0];
        if (port) {
          const hostPort = result.ports[port][0]?.HostPort;
          if (hostPort) {
            window.open(`http://localhost:${hostPort}`, '_blank');
          } else {
            throw new Error('Aucun port exposé disponible pour ce conteneur');
          }
        } else {
          throw new Error('Aucune interface web disponible pour ce conteneur');
        }
      }

      toast({
        title: 'Succès',
        description: result.message || `Conteneur ${action === 'delete' ? 'supprimé' : action + 'é'} avec succès`,
      });

      onSuccess?.();
    } catch (error) {
      console.error(`Échec de l'action ${action} sur le conteneur:`, error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : `Échec de l'action ${action} sur le conteneur`,
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
