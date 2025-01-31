'use client';

import { DockerImage } from '@/lib/docker/types';
import { ImageCard } from './image-card';
import { Loading } from '@/components/ui/loading';
import { ErrorMessage } from '@/components/ui/error-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCwIcon, Database, Tag, Clock, HardDrive } from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { ContainerCreation } from '@/components/containers';
import { cn } from '@/lib/utils';

interface ImageListProps {
  images: DockerImage[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function ImageList({ 
  images, 
  isLoading, 
  error, 
  onRefresh 
}: ImageListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    const query = searchQuery.toLowerCase();
    return images.filter(image => 
      image.RepoTags?.[0]?.toLowerCase().includes(query) ||
      image.Id.toLowerCase().includes(query)
    );
  }, [images, searchQuery]);

  const onContainerCreated = () => {
    setIsCreateDialogOpen(false);
    onRefresh();
  };

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorMessage message={error} />
        <Button onClick={onRefresh} variant="outline" size="sm">
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <h3 className="mb-2 text-lg font-medium">No images found</h3>
        <p className="text-sm text-muted-foreground">
          Get started by pulling a Docker image.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search images..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-background border-border hover:border-primary/50 transition-colors"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredImages.map((image, index) => (
            <motion.div
              key={image.Id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <div className="group relative overflow-hidden rounded-lg border border-zinc-800/50 bg-gradient-to-br from-zinc-900 via-zinc-800/50 to-zinc-900 p-4 shadow-lg backdrop-blur-sm transition-all hover:border-blue-500/30 hover:shadow-blue-500/5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-zinc-200 truncate">
                        {image.RepoTags?.[0]?.split(':')[0] || 'Untitled'}
                      </h3>
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                        {image.RepoTags?.[0]?.split(':')[1] || 'latest'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-4 w-4" />
                        <span>{(image.Size / (1024 * 1024)).toFixed(1)} MB</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {new Date(image.Created * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ContainerCreation
                      open={isCreateDialogOpen}
                      onOpenChange={setIsCreateDialogOpen}
                      preSelectedImage={image}
                      onSuccess={onContainerCreated}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-zinc-900/50 border-zinc-800 hover:border-blue-500/30 hover:bg-blue-500/10"
                      onClick={() => {/* TODO: Implémenter la fonction d'inspection */}}
                    >
                      Inspect
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => {/* TODO: Implémenter la fonction de suppression */}}
                  >
                    Delete
                  </Button>
                </div>

                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-zinc-500/10 to-transparent" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}