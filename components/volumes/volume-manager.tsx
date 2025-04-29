import { useState } from 'react';
import { BackupList } from './backup-list';
import { VolumeList } from './volume-list';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Archive } from 'lucide-react';

export function VolumeManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [volumeName, setVolumeName] = useState('');
  const [driver, setDriver] = useState('local');
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingBackup, setLoadingBackup] = useState<string | null>(null);

  const { toast } = useToast();

  // Validation stricte du nom de volume
  const isValidVolumeName = (name: string) => /^[a-zA-Z0-9_-]+$/.test(name);

  const handleCreateVolume = async () => {
    // Validation stricte du nom de volume
    if (!isValidVolumeName(volumeName)) {
      toast({
        title: 'Nom de volume invalide',
        description: 'Utilisez uniquement lettres, chiffres, tirets ou underscores',
        variant: 'destructive',
      });
      return;
    }
    setLoadingCreate(true);
    try {
      const response = await fetch('/api/volumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: volumeName,
          driver: driver
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Failed to create volume');
      }

      toast({
        title: 'Volume créé',
        description: `Le volume ${volumeName} a été créé avec succès`,
      });

      setIsCreateOpen(false);
      setVolumeName('');
      setDriver('local');
      // Rafraîchir la liste après création
      if (typeof window !== 'undefined') window.location.reload();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de créer le volume',
        variant: 'destructive',
      });
    } finally {
      setLoadingCreate(false);
    }
  };

  // Fonction de backup de volume avec validation stricte, gestion loading, et affichage d'erreur détaillée
  const handleBackupVolume = async (volumeName: string) => {
    // Validation stricte du nom de volume
    if (!isValidVolumeName(volumeName)) {
      throw new Error('Nom de volume invalide');
    }
    setLoadingBackup(volumeName);
    try {
      const response = await fetch('/api/volumes/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: volumeName }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Failed to backup volume');
      }
      // Succès silencieux, laisse VolumeList gérer le feedback
    } finally {
      setLoadingBackup(null);
    }
  };



  return (
    <div className="space-y-4">

      <div className="flex justify-between items-center">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>Créer un Volume</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un nouveau volume</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du volume</Label>
                <Input
                  id="name"
                  value={volumeName}
                  onChange={(e) => setVolumeName(e.target.value)}
                  placeholder="mon-volume"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver">Driver</Label>
                <Input
                  id="driver"
                  value={driver}
                  onChange={(e) => setDriver(e.target.value)}
                  placeholder="local"
                />
              </div>
              <Button onClick={handleCreateVolume} className="w-full" disabled={loadingCreate}>
                {loadingCreate ? 'Création...' : 'Créer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="volumes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="volumes">
            <Database className="h-4 w-4 mr-2" />
            Volumes
          </TabsTrigger>
          <TabsTrigger value="backups">
            <Archive className="h-4 w-4 mr-2" />
            Backups
          </TabsTrigger>
        </TabsList>
        <TabsContent value="volumes" className="space-y-4">
          <VolumeList onBackup={handleBackupVolume} />
        </TabsContent>
        <TabsContent value="backups" className="space-y-4">
          <BackupList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
