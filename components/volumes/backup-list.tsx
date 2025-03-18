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
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

interface VolumeBackup {
  id: string;
  volumeName: string;
  createdAt: string;
  size: number;
  path: string;
}

export function BackupList() {
  const [backups, setBackups] = useState<VolumeBackup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backupToDelete, setBackupToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBackups = async () => {
    try {
      const response = await fetch('/api/volumes/backup');
      if (!response.ok) throw new Error('Failed to fetch backups');
      const data = await response.json();
      setBackups(data.backups || []);
    } catch (error) {
      console.error('Error fetching backups:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les backups',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleRestoreBackup = async (backupId: string) => {
    try {
      const response = await fetch(`/api/volumes/backup/${backupId}/restore`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to restore backup');

      toast({
        title: 'Backup restauré',
        description: 'Le volume a été restauré avec succès',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de restaurer le backup',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteBackup = async () => {
    if (!backupToDelete) return;

    try {
      const response = await fetch(`/api/volumes/backup/${backupToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete backup');

      toast({
        title: 'Backup supprimé',
        description: 'Le backup a été supprimé avec succès',
      });

      fetchBackups();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le backup',
        variant: 'destructive',
      });
    } finally {
      setBackupToDelete(null);
    }
  };

  if (isLoading) {
    return <div>Chargement des backups...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Backups des Volumes</h3>
        <Button onClick={fetchBackups} variant="outline">
          Rafraîchir
        </Button>
      </div>

      {backups.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          Aucun backup disponible
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Volume</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead>Taille</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map((backup) => (
              <TableRow key={backup.id}>
                <TableCell>{backup.volumeName}</TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(backup.createdAt), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </TableCell>
                <TableCell>
                  {(backup.size / (1024 * 1024)).toFixed(2)} MB
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreBackup(backup.id)}
                    >
                      Restaurer
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setBackupToDelete(backup.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog
        open={!!backupToDelete}
        onOpenChange={() => setBackupToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce backup ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBackup}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
