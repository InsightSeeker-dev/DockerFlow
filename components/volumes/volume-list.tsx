import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '../../components/ui/alert-dialog';
import { Badge } from '../../components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Volume {
  name: string;
  driver: string;
  mountpoint: string;
  labels?: Record<string, string>;
  UsedBy: string[];
  created?: string;
  size?: number;
  Status?: 'active' | 'unused';
}

interface VolumeListProps {
  onBackup?: (volumeName: string) => void;
  onStatsUpdate?: (stats: {
    totalVolumes: number;
    totalSize: number;
    activeVolumes: number;
    unusedVolumes: number;
  }) => void;
}

export function VolumeList({ onBackup, onStatsUpdate }: VolumeListProps) {
  const [isBackingUp, setIsBackingUp] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [volumeToDelete, setVolumeToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const { toast } = useToast();

  const fetchVolumes = async () => {
    try {
      console.log('Fetching volumes...');
      const response = await fetch('/api/volumes', { credentials: 'include' });
      console.log('Response status:', response.status);
      if (!response.ok) throw new Error('Failed to fetch volumes');
      const data = await response.json();
      console.log('API response:', data);
      
      const volumesWithStats = data.Volumes?.map((volume: Volume) => {
        console.log('Processing volume:', volume);
        return {
          ...volume,
          Status: volume.UsedBy?.length > 0 ? 'active' : 'unused',
        };
      }) || [];
      
      setVolumes(volumesWithStats);
      
      // Calculer les statistiques
      if (onStatsUpdate) {
        const stats = {
          totalVolumes: volumesWithStats.length,
          totalSize: volumesWithStats.reduce((acc: number, vol: Volume) => acc + (vol.size || 0), 0),
          activeVolumes: volumesWithStats.filter((vol: Volume) => vol.Status === 'active').length,
          unusedVolumes: volumesWithStats.filter((vol: Volume) => vol.Status === 'unused').length,
        };
        onStatsUpdate(stats);
      }
    } catch (error) {
      console.error('Error fetching volumes:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les volumes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVolumes();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchVolumes, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteVolume = async () => {
    if (!volumeToDelete) return;
    setLoadingDelete(true);
    try {
      const response = await fetch(`/api/volumes/${volumeToDelete}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === 'Volume is in use') {
          setDeleteError(`Le volume est utilisé par : ${data.containers.join(', ')}`);
          setLoadingDelete(false);
          return;
        }
        throw new Error(data.error || 'Failed to delete volume');
      }

      toast({
        title: 'Volume supprimé',
        description: `Le volume ${volumeToDelete} a été supprimé avec succès`,
      });
      fetchVolumes();
    } catch (error) {
      console.error('Error deleting volume:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le volume',
        variant: 'destructive',
      });
    } finally {
      setVolumeToDelete(null);
      setDeleteError(null);
      setLoadingDelete(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Volumes</h2>
        <Button onClick={fetchVolumes} variant="outline">
          Rafraîchir
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-3">Chargement des volumes...</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-950">
          <Table className="min-w-[700px]">

          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Point de montage</TableHead>
              <TableHead>Utilisé par</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {volumes
              .filter(volume => volume.name !== 'dockerflow_traefik-acme' && volume.name !== 'dockerflow_traefik-logs')
              .map((volume) => (
              <TableRow key={volume.name} className="hover:bg-gray-800 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2" /><rect x="8" y="8" width="8" height="8" rx="2" fill="currentColor" className="text-blue-500" /></svg>
                    <span className="font-semibold text-gray-200">{volume.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{volume.driver}</span>
                    <Badge variant={volume.Status === 'active' ? 'default' : 'secondary'} className={volume.Status === 'active' ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}>
                      {volume.Status === 'active' ? (
                        <span className="inline-flex items-center gap-1"><svg className="w-3 h-3 text-green-300" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" /></svg> Actif</span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" /></svg> Inutilisé</span>
                      )}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate">{volume.mountpoint}</TableCell>
                <TableCell>
                  {volume.UsedBy.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {volume.UsedBy.map(container => (
                        <Badge key={container} variant="secondary">
                          {container}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="outline">Non utilisé</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {volume.created
                    ? formatDistanceToNow(new Date(volume.created), { addSuffix: true, locale: fr })
                    : volume.labels?.['created-at']
                      ? formatDistanceToNow(new Date(volume.labels['created-at']), { addSuffix: true, locale: fr })
                      : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setVolumeToDelete(volume.name)}
                      disabled={volume.UsedBy.length > 0 || loadingDelete}
                    >
                      {loadingDelete && volumeToDelete === volume.name ? 'Suppression...' : 'Supprimer'}
                    </Button>
                    {onBackup && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBackupVolume(volume.name)}
                        disabled={isBackingUp === volume.name || loadingDelete}
                      >
                        {isBackingUp === volume.name
                          ? (<span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-b-2 border-gray-600 rounded-full"></span> Backup...</span>)
                          : 'Backup'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

      <AlertDialog open={!!volumeToDelete} onOpenChange={() => {
        setVolumeToDelete(null);
        setDeleteError(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Êtes-vous sûr de vouloir supprimer le volume {volumeToDelete} ?
              Cette action est irréversible.</p>
              {deleteError && (
                <p className="text-red-500">{deleteError}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVolume}
              className="bg-red-600 hover:bg-red-700"
              disabled={!!deleteError}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // Fonction locale pour gérer le backup avec feedback UX
  function handleBackupVolume(volumeName: string) {
    setIsBackingUp(volumeName);
    toast({ title: 'Backup en cours...', description: `Le backup de ${volumeName} a démarré.` });
    Promise.resolve(onBackup?.(volumeName))
      .then(() => {
        toast({ title: 'Backup réussi', description: `Le backup de ${volumeName} est terminé.` });
        fetchVolumes(); // Rafraîchir la liste sans reload global
      })
      .catch((error) => {
        toast({
          title: 'Erreur',
          description: error instanceof Error ? error.message : 'Impossible de créer le backup',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setIsBackingUp(null);
      });
  }
}