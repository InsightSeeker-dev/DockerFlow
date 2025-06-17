"use client";

import { useImages } from '@/hooks/use-images';
import { PullImageDialog } from '@/components/images/pull-image-dialog';
import { ImageList } from '@/components/images/image-list';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function UserImagesPage() {
  const { images, isLoading, error, refresh } = useImages();
  const [showPullDialog, setShowPullDialog] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-400">Mes images Docker</h1>
        <div className="flex gap-2">
          <Button onClick={refresh} variant="outline" className="border-gray-700 hover:bg-gray-800">
            <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
          </Button>
          <Button onClick={() => setShowPullDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            Pull une image
          </Button>
        </div>
      </div>

      {/* Pull Image Dialog */}
      {showPullDialog && (
        <PullImageDialog onSuccess={() => { setShowPullDialog(false); refresh(); }} />
      )}
      {/* Liste des images */}
      <ImageList
        images={images}
        isLoading={isLoading}
        error={error}
        onRefresh={refresh}
      />
    </div>
  );
}
