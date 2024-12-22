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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import ImageBuilder from './ImageBuilder';
import { formatBytes, formatDate } from '@/lib/utils';

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
  const [showBuilder, setShowBuilder] = useState(false);
  const [pullDialogOpen, setPullDialogOpen] = useState(false);
  const [pullForm, setPullForm] = useState({ repository: '', tag: 'latest' });
  const [selectedImage, setSelectedImage] = useState<DockerImage | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const response = await fetch('/api/admin/images');
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      setImages(data);
    } catch (error) {
      toast.error('Failed to fetch Docker images');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePullImage = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/images/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pullForm),
      });

      if (!response.ok) throw new Error('Failed to pull image');
      
      toast.success('Image pulled successfully');
      setPullDialogOpen(false);
      fetchImages();
    } catch (error) {
      toast.error('Failed to pull image');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/images/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      toast.success('Image supprimée avec succès');
      fetchImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Erreur lors de la suppression de l\'image');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Images Docker</h2>
        <div className="space-x-4">
          <Dialog open={pullDialogOpen} onOpenChange={setPullDialogOpen}>
            <DialogTrigger asChild>
              <Button>Pull Image</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pull Docker Image</DialogTitle>
                <DialogDescription>
                  Enter the repository and tag of the image you want to pull.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="repository">Repository</Label>
                  <Input
                    id="repository"
                    value={pullForm.repository}
                    onChange={(e) =>
                      setPullForm({ ...pullForm, repository: e.target.value })
                    }
                    placeholder="e.g., nginx"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tag">Tag</Label>
                  <Input
                    id="tag"
                    value={pullForm.tag}
                    onChange={(e) =>
                      setPullForm({ ...pullForm, tag: e.target.value })
                    }
                    placeholder="e.g., latest"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handlePullImage}
                  disabled={!pullForm.repository}
                >
                  Pull Image
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button onClick={() => setShowBuilder(true)}>Build Image</Button>
        </div>
      </div>

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
                <TableCell className="font-medium">{image.name}</TableCell>
                <TableCell>{image.tag}</TableCell>
                <TableCell>{formatBytes(image.size)}</TableCell>
                <TableCell>{new Date(image.created).toLocaleString()}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteImage(image.id)}
                    className="text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Image Details Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Image Details</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID</Label>
                  <div className="font-mono text-sm">{selectedImage.id}</div>
                </div>
              </div>

              <div>
                <Label>Created</Label>
                <div className="text-sm">{new Date(selectedImage.created).toLocaleString()}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Build Docker Image</DialogTitle>
          </DialogHeader>
          <ImageBuilder onSuccess={() => {
            setShowBuilder(false);
            fetchImages();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
