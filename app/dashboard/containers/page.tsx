"use client";

import { useContainers } from '@/hooks/use-containers';
import { PullImageDialog } from '@/components/images/pull-image-dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, PlusIcon } from 'lucide-react';
import { useState } from 'react';

export default function UserContainersPage() {
  const { containers, isLoading, error, refresh } = useContainers();
  const [showPullDialog, setShowPullDialog] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-400">Mes containers</h1>
        <div className="flex gap-2">
          <Button onClick={refresh} variant="outline" className="border-gray-700 hover:bg-gray-800">
            <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
          </Button>
          <Button onClick={() => setShowPullDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <PlusIcon className="h-4 w-4 mr-2" /> Pull une image
          </Button>
        </div>
      </div>

      {/* Pull Image Dialog (réutilise le composant existant) */}
      {showPullDialog && (
        <PullImageDialog onSuccess={() => { setShowPullDialog(false); refresh(); }} />
      )}

      {/* Liste des containers */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="text-red-500">Erreur : {error}</div>
      ) : containers.length === 0 ? (
        <div className="text-gray-400 text-center py-8">Aucun container trouvé.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/70">
          <table className="min-w-full divide-y divide-gray-800">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Nom</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Image</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Ports</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {containers.map((container) => (
                <tr key={container.Id}>
  <td className="px-4 py-2 font-medium text-gray-200">{container.Names && container.Names[0] ? container.Names[0].replace(/^\//, '') : ''}</td>
  <td className="px-4 py-2 text-gray-300">{container.Image}</td>
  <td className="px-4 py-2">
    <span className={`px-2 py-1 rounded text-xs font-semibold ${container.State === 'running' ? 'bg-green-600/30 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
      {container.State}
    </span>
  </td>
  <td className="px-4 py-2 text-gray-300">
    {container.Ports?.length ?
      container.Ports.map((p: any) => `${p.PublicPort}:${p.PrivatePort}`).join(', ') :
      '—'}
  </td>
  <td className="px-4 py-2 text-gray-400">{container.Created ? new Date(container.Created * 1000).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
