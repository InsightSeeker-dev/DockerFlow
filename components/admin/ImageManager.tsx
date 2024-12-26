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
import DockerfileBuilder from './DockerfileBuilder';
import DockerfileBuildFromFile from './DockerfileBuildFromFile';
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
  const [filterTag, setFilterTag] = useState('');

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
      filterAndSortImages(data, searchTerm, sortBy, filterTag);
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
    tag: string
  ) => {
    let filtered = [...imageList];

    if (search) {
      filtered = filtered.filter((image) =>
        image.RepoTags?.some((tag) =>
          tag.toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    if (tag) {
      filtered = filtered.filter((image) =>
        image.RepoTags?.some((t) => t === tag)
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
      const response = await fetch('/api/admin/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
      });

      if (!response.ok) throw new Error('Failed to delete image');
      
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
        description: 'Failed to delete image. Please try again.',
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

  const getAvailableTags = () => {
    const tags = new Set<string>();
    images.forEach((image) => {
      image.RepoTags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  };

  useEffect(() => {
    fetchImages();
  }, []);

  useEffect(() => {
    filterAndSortImages(images, searchTerm, sortBy, filterTag);
  }, [searchTerm, sortBy, filterTag, images]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Docker Images</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchImages}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="pull">Pull Image</TabsTrigger>
          <TabsTrigger value="build">Build Image</TabsTrigger>
          <TabsTrigger value="buildfile">Build from File</TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-4">
          <ImageSearch
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterTag={filterTag}
            onFilterChange={setFilterTag}
            availableTags={getAvailableTags()}
          />

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
          <DockerfileBuilder onImageBuilt={fetchImages} />
        </TabsContent>

        <TabsContent value="buildfile">
          <DockerfileBuildFromFile onImageBuilt={fetchImages} />
        </TabsContent>
      </Tabs>

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

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this image?
              {selectedImage?.RepoTags?.[0] && (
                <p className="mt-2 font-medium">{selectedImage.RepoTags[0]}</p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
