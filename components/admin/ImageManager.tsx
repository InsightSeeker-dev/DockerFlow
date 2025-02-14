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

  // État séparé pour la recherche locale
  const [localSearch, setLocalSearch] = useState({
    term: '',
    sortBy: 'newest'
  });

  // État séparé pour la recherche Docker Hub
  const [hubSearch, setHubSearch] = useState({
    term: '',
    sortBy: 'stars'
  });

  // État pour l'image à pull
  const [imageToPull, setImageToPull] = useState('');

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
      filterAndSortImages(data, localSearch.term, localSearch.sortBy);
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

  // Réinitialiser les filtres selon le mode
  const resetFilters = (mode: 'local' | 'hub') => {
    if (mode === 'local') {
      setLocalSearch({ term: '', sortBy: 'newest' });
      filterAndSortImages(images, '', 'newest');
    } else {
      setHubSearch({ term: '', sortBy: 'stars' });
    }
  };

  // Gestionnaires d'événements séparés pour chaque mode
  const handleLocalSearchChange = (term: string) => {
    setLocalSearch(prev => ({ ...prev, term }));
    filterAndSortImages(images, term, localSearch.sortBy);
  };

  const handleLocalSortChange = (sortBy: string) => {
    setLocalSearch(prev => ({ ...prev, sortBy }));
    filterAndSortImages(images, localSearch.term, sortBy);
  };

  const handleHubSearchChange = (term: string) => {
    setHubSearch(prev => ({ ...prev, term }));
  };

  const handleHubSortChange = (sortBy: string) => {
    setHubSearch(prev => ({ ...prev, sortBy }));
  };

  // Fonction pour gérer le pull d'une image
  const handlePullImage = (imageName: string) => {
    setImageToPull(imageName);
    setActiveTab('pull');
  };

  useEffect(() => {
    fetchImages();
  }, []);

  useEffect(() => {
    filterAndSortImages(images, localSearch.term, localSearch.sortBy);
  }, [localSearch.term, localSearch.sortBy, images]);

  return (
    <div className="space-y-6">
      <div className="bg-[#0B1120] rounded-lg">
        <div className="flex h-10 items-center border-b border-border">
          <div className="flex items-center">
            <button
              onClick={() => setActiveTab('images')}
              className={`h-10 px-4 ${activeTab === 'images' ? 'bg-[#1e293b] text-foreground' : 'text-muted-foreground'}`}
            >
              Images
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`h-10 px-4 ${activeTab === 'search' ? 'bg-[#1e293b] text-foreground' : 'text-muted-foreground'}`}
            >
              Search Image
            </button>
            <button
              onClick={() => setActiveTab('pull')}
              className={`h-10 px-4 ${activeTab === 'pull' ? 'bg-[#1e293b] text-foreground' : 'text-muted-foreground'}`}
            >
              Pull Image
            </button>
            <button
              onClick={() => setActiveTab('build')}
              className={`h-10 px-4 ${activeTab === 'build' ? 'bg-[#1e293b] text-foreground' : 'text-muted-foreground'}`}
            >
              Build Image
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'images' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <ImageSearch
                    mode="local"
                    searchTerm={localSearch.term}
                    onSearchChange={handleLocalSearchChange}
                    sortBy={localSearch.sortBy}
                    onSortChange={handleLocalSortChange}
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() => resetFilters('local')}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredImages.map((image) => (
                  <Card key={image.Id}>
                    <CardHeader>
                      <CardTitle className="font-mono text-sm">
                        {image.RepoTags?.[0] || 'Untitled'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
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
            </div>
          )}

          {activeTab === 'search' && (
            <ImageSearch
              mode="hub"
              searchTerm={hubSearch.term}
              onSearchChange={handleHubSearchChange}
              sortBy={hubSearch.sortBy}
              onSortChange={handleHubSortChange}
              onPullImage={handlePullImage}
            />
          )}

          {activeTab === 'pull' && (
            <ImagePuller 
              onImagePulled={fetchImages} 
              defaultImage={imageToPull}
            />
          )}

          {activeTab === 'build' && (
            <UnifiedImageBuilder onImageBuilt={fetchImages} />
          )}
        </div>
      </div>

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
