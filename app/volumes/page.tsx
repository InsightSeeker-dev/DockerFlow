import { VolumeList } from '../../components/volumes/volume-list';
import { BackupList } from '../../components/volumes/backup-list';
import { useToast } from '../../components/ui/use-toast';
import { useState } from 'react';

export default function VolumesPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'volumes' | 'backups'>('volumes');



  const handleBackup = async (volumeName: string) => {
    try {
      const response = await fetch(`/api/volumes/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: volumeName })
      });
      if (!response.ok) throw new Error('Backup échoué');
      toast({ title: 'Backup lancé', description: `Le backup du volume ${volumeName} a démarré.` });
    } catch (e) {
      toast({ title: 'Erreur', description: `Impossible de lancer le backup : ${e}` });
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button className={`px-4 py-2 rounded ${tab==='volumes' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`} onClick={()=>setTab('volumes')}>Volumes</button>
        <button className={`px-4 py-2 rounded ${tab==='backups' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`} onClick={()=>setTab('backups')}>Backups</button>
      </div>
      {tab === 'volumes' ? <VolumeList onBackup={handleBackup} /> : <BackupList />}
    </div>
  );
}