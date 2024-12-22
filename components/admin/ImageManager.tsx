'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DockerImage {
  id: string;
  userId: string;
  name: string;
  tag: string;
  size: number;
  created: Date;
}

export default function ImageManager() {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<DockerImage | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const response = await fetch('/api/admin/images');
      if (response.ok) {
        const data = await response.json();
        setImages(data);
      } else {
        throw new Error('Failed to fetch images');
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async (image: DockerImage) => {
    setSelectedImage(image);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedImage) return;

    try {
      const response = await fetch(`/api/admin/images/${selectedImage.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setImages(images.filter((img) => img.id !== selectedImage.id));
        setIsDeleteDialogOpen(false);
        setSelectedImage(null);
      } else {
        throw new Error('Failed to delete image');
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {images.map((image) => (
              <TableRow key={image.id}>
                <TableCell>{image.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{image.tag}</Badge>
                </TableCell>
                <TableCell>{formatSize(image.size)}</TableCell>
                <TableCell>
                  {new Date(image.created).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteImage(image)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this image? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
