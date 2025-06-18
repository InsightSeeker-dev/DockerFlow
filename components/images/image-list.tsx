'use client';

import { DockerImage } from '@/components/containers/types';
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
  images = [], 
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
              <ImageCard image={image} onRemove={onRefresh} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}