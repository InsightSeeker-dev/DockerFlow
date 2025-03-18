import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Volume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  Labels: Record<string, string>;
  UsedBy: string[];
  CreatedAt?: string;
  Size?: number;
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
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [volumeToDelete, setVolumeToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchVolumes = async () => {
    try {
      const response = await fetch('/api/volumes');
      if (!response.ok) throw new Error('Failed to fetch volumes');
      const data = await response.json();
      const volumesWithStats = data.Volumes?.map((volume: Volume) => ({
        ...volume,
        Status: volume.UsedBy.length > 0 ? 'active' : 'unused',
      })) || [];
      
      setVolumes(volumesWithStats);
      
      // Calculer les statistiques
      if (onStatsUpdate) {
        const stats = {
          totalVolumes: volumesWithStats.length,
          totalSize: volumesWithStats.reduce((acc: number, vol: Volume) => acc + (vol.Size || 0), 0),
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

    try {
      const response = await fetch('/api/volumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          name: volumeToDelete,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === 'Volume is in use') {
          setDeleteError(`Le volume est utilisé par : ${data.containers.join(', ')}`);
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
        <div>Chargement des volumes...</div>
      ) : (
        <Table>
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
            {volumes.map((volume) => (
              <TableRow key={volume.Name}>
                <TableCell>{volume.Name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{volume.Driver}</span>
                    <Badge variant={volume.Status === 'active' ? 'default' : 'secondary'}>
                      {volume.Status === 'active' ? 'Actif' : 'Inutilisé'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate">{volume.Mountpoint}</TableCell>
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
                  {volume.Labels?.['created-at'] 
                    ? formatDistanceToNow(new Date(volume.Labels['created-at']), { 
                        addSuffix: true,
                        locale: fr 
                      })
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setVolumeToDelete(volume.Name)}
                      disabled={volume.UsedBy.length > 0}
                    >
                      Supprimer
                    </Button>
                    {onBackup && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onBackup(volume.Name)}
                      >
                        Backup
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
}