'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCcw, Trash2, Info, Copy, ExternalLink } from 'lucide-react';
import ImagePuller from './ImagePuller';
import UnifiedImageBuilder from './UnifiedImageBuilder';
import ImageSearch from './ImageSearch';

interface DockerImage {
  Id: string;
  RepoTags: string[];
  Size: number;
  Created: number;
  Architecture?: string;
  Os?: string;
  Author?: string;
  Labels?: Record<string, string>;
}

export default function ImageManager() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('images');
  const [images, setImages] = useState<DockerImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<DockerImage | null>(null);
  const [showImageInfo, setShowImageInfo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const formatSize = (size: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let formattedSize = size;
    let unitIndex = 0;
    while (formattedSize >= 1024 && unitIndex < units.length - 1) {
      formattedSize /= 1024;
      unitIndex++;
    }
    return `${formattedSize.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/images/list');
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      setImages(data);
      filterAndSortImages(data, searchTerm, sortBy);
      toast({
        title: 'Images refreshed',
        description: `Successfully loaded ${data.length} images`,
      });
    } catch (error) {
      console.error('Error fetching images:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch images. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortImages = (
    imageList: DockerImage[],
    search: string,
    sort: string,
  ) => {
    let filtered = [...imageList];

    if (search) {
      filtered = filtered.filter((image) =>
        image.RepoTags?.some((tag) =>
          tag.toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    filtered.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return b.Created - a.Created;
        case 'oldest':
          return a.Created - b.Created;
        case 'name':
          return (a.RepoTags?.[0] || '').localeCompare(b.RepoTags?.[0] || '');
        case 'size':
          return b.Size - a.Size;
        default:
          return 0;
      }
    });

    setFilteredImages(filtered);
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete image');
      }
      
      toast({
        title: 'Success',
        description: 'Image deleted successfully',
      });
      fetchImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete image. Please try again.',
      });
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied',
        description: 'Text copied to clipboard',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to copy text',
      });
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSortBy('newest');
    toast({
      title: 'Filters Reset',
      description: 'Search filters have been reset to default values',
    });
  };

  useEffect(() => {
    fetchImages();
  }, []);

  useEffect(() => {
    filterAndSortImages(images, searchTerm, sortBy);
  }, [searchTerm, sortBy, images]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Docker Images</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="pull">Pull Image</TabsTrigger>
          <TabsTrigger value="build">Build Image</TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <ImageSearch
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            </div>
            <Button
              variant="outline"
              className="h-12 px-4 bg-white/5 backdrop-blur-sm border-2 border-gray-700 hover:border-gray-600"
              onClick={resetFilters}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredImages.map((image) => (
              <Card key={image.Id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="font-mono text-sm">
                    {image.RepoTags?.[0] || 'Untitled'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <code className="text-xs">{image.Id.substring(7, 19)}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => copyToClipboard(image.Id)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Size: {formatSize(image.Size)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created: {formatDate(image.Created)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {image.RepoTags?.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedImage(image);
                      setShowImageInfo(true);
                    }}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedImage(image);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pull">
          <ImagePuller onImagePulled={fetchImages} />
        </TabsContent>

        <TabsContent value="build">
          <UnifiedImageBuilder onImageBuilt={fetchImages} />
        </TabsContent>
      </Tabs>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Docker Image</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>Are you sure you want to delete this Docker image? This action cannot be undone.</p>
              {selectedImage && (
                <>
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Image:</span>
                      <span>{selectedImage.RepoTags?.[0] || 'Untitled'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">ID:</span>
                      <code className="text-xs bg-background px-2 py-1 rounded">
                        {selectedImage.Id.substring(7, 19)}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Size:</span>
                      <span>{formatSize(selectedImage.Size)}</span>
                    </div>
                  </div>
                  {selectedImage.RepoTags && selectedImage.RepoTags.length > 1 && (
                    <div className="mt-2 p-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded">
                      <p className="text-sm">
                        Warning: This image has multiple tags. All tags will be removed.
                      </p>
                    </div>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedImage && handleDeleteImage(selectedImage.Id)}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Image
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImageInfo} onOpenChange={setShowImageInfo}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Image Details</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Repository Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedImage.RepoTags?.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">ID</h4>
                  <div className="flex items-center space-x-2">
                    <code className="bg-muted px-2 py-1 rounded">{selectedImage.Id}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(selectedImage.Id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Size</h4>
                  <p>{formatSize(selectedImage.Size)}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Created</h4>
                  <p>{formatDate(selectedImage.Created)}</p>
                </div>
                {selectedImage.Architecture && (
                  <div>
                    <h4 className="font-medium mb-2">Architecture</h4>
                    <p>{selectedImage.Architecture}</p>
                  </div>
                )}
                {selectedImage.Os && (
                  <div>
                    <h4 className="font-medium mb-2">Operating System</h4>
                    <p>{selectedImage.Os}</p>
                  </div>
                )}
                {selectedImage.Author && (
                  <div>
                    <h4 className="font-medium mb-2">Author</h4>
                    <p>{selectedImage.Author}</p>
                  </div>
                )}
                {selectedImage.Labels && Object.keys(selectedImage.Labels).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Labels</h4>
                    <div className="space-y-2">
                      {Object.entries(selectedImage.Labels).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-mono text-sm">{key}: </span>
                          <span className="text-sm text-muted-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
