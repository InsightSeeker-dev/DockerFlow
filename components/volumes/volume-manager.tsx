import { useState } from 'react';
import { BackupList } from './backup-list';
import { VolumeList } from './volume-list';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, HardDrive, Archive } from 'lucide-react';

interface VolumeStats {
  totalVolumes: number;
  totalSize: number;
  activeVolumes: number;
  unusedVolumes: number;
}

export function VolumeManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [volumeName, setVolumeName] = useState('');
  const [driver, setDriver] = useState('local');
  const [stats, setStats] = useState<VolumeStats>({
    totalVolumes: 0,
    totalSize: 0,
    activeVolumes: 0,
    unusedVolumes: 0
  });
  const { toast } = useToast();

  const handleCreateVolume = async () => {
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
        throw new Error(error.message || 'Failed to create volume');
      }

      toast({
        title: 'Volume créé',
        description: `Le volume ${volumeName} a été créé avec succès`,
      });

      setIsCreateOpen(false);
      setVolumeName('');
      setDriver('local');
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de créer le volume',
        variant: 'destructive',
      });
    }
  };

  const handleBackupVolume = async (volumeName: string) => {
    try {
      const response = await fetch('/api/volumes/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: volumeName }),
      });

      if (!response.ok) {
        throw new Error('Failed to backup volume');
      }

      toast({
        title: 'Backup créé',
        description: `Le backup du volume ${volumeName} a été créé avec succès`,
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le backup',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volumes</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVolumes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Espace Total</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volumes Actifs</CardTitle>
            <Database className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeVolumes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volumes Inutilisés</CardTitle>
            <Database className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unusedVolumes}</div>
          </CardContent>
        </Card>
      </div>

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
              <Button onClick={handleCreateVolume} className="w-full">
                Créer
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
          <VolumeList onBackup={handleBackupVolume} onStatsUpdate={setStats} />
        </TabsContent>
        <TabsContent value="backups" className="space-y-4">
          <BackupList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
