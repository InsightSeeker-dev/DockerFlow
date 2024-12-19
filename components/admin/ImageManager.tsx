'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Trash2,
  RefreshCcw,
  Download,
  Upload,
  Search,
  Filter,
  Tag,
  Clock,
  HardDrive,
  Settings2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  created: string;
  size: number;
  digest: string;
  labels: Record<string, string>;
  history: Array<{
    created: string;
    command: string;
  }>;
}

export default function ImageManager() {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<DockerImage | null>(null);
  const [filter, setFilter] = useState({ repository: '', tag: '' });
  const [showPull, setShowPull] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pullImage, setPullImage] = useState({ repository: '', tag: 'latest' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const response = await fetch('/api/admin/images');
      if (response.ok) {
        const data = await response.json();
        setImages(data);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Erreur lors de la récupération des images');
    }
  };

  const handlePullImage = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/images/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pullImage),
      });

      if (response.ok) {
        toast.success('Image téléchargée avec succès');
        setShowPull(false);
        setPullImage({ repository: '', tag: 'latest' });
        fetchImages();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors du téléchargement de l\'image');
      }
    } catch (error) {
      console.error('Error pulling image:', error);
      toast.error('Erreur lors du téléchargement de l\'image');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Image supprimée avec succès');
        fetchImages();
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Erreur lors de la suppression de l\'image');
    }
  };

  const handleViewHistory = async (image: DockerImage) => {
    setSelectedImage(image);
    setShowHistory(true);
  };

  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const filteredImages = images.filter(image => {
    const matchRepository = image.repository.toLowerCase().includes(filter.repository.toLowerCase());
    const matchTag = !filter.tag || image.tag === filter.tag;
    return matchRepository && matchTag;
  });

  const uniqueTags = Array.from(new Set(images.map(image => image.tag))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Images Docker</h2>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={fetchImages}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={() => setShowPull(true)}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger une image
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Recherche par nom</Label>
              <div className="relative">
                <Search className="absolute left-2 top-3 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-8"
                  placeholder="Rechercher une image..."
                  value={filter.repository}
                  onChange={(e) => setFilter({ ...filter, repository: e.target.value })}
                />
              </div>
            </div>
            <div className="flex-1">
              <Label>Tag</Label>
              <Select
                value={filter.tag}
                onValueChange={(value) => setFilter({ ...filter, tag: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {uniqueTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repository</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Créée</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredImages.map((image) => (
                <TableRow key={image.id}>
                  <TableCell className="font-medium">{image.repository}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      <Tag className="h-3 w-3 mr-1" />
                      {image.tag}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {image.id.substring(7, 19)}
                  </TableCell>
                  <TableCell>{formatSize(image.size)}</TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(image.created), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewHistory(image)}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteImage(image.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pull Image Dialog */}
      <Dialog open={showPull} onOpenChange={setShowPull}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Télécharger une image Docker</DialogTitle>
            <DialogDescription>
              Spécifiez le nom de l'image et le tag à télécharger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom de l'image</Label>
              <Input
                placeholder="nginx"
                value={pullImage.repository}
                onChange={(e) => setPullImage({ ...pullImage, repository: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tag</Label>
              <Input
                placeholder="latest"
                value={pullImage.tag}
                onChange={(e) => setPullImage({ ...pullImage, tag: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPull(false)}>
              Annuler
            </Button>
            <Button onClick={handlePullImage} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                  Téléchargement...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Historique de l'image</DialogTitle>
            {selectedImage && (
              <DialogDescription>
                {selectedImage.repository}:{selectedImage.tag}
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              {/* Image Details */}
              <div className="space-y-2">
                <h3 className="font-medium">Détails de l'image</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>ID</Label>
                    <div className="font-mono">{selectedImage.id}</div>
                  </div>
                  <div>
                    <Label>Digest</Label>
                    <div className="font-mono text-xs">{selectedImage.digest}</div>
                  </div>
                  <div>
                    <Label>Taille</Label>
                    <div>{formatSize(selectedImage.size)}</div>
                  </div>
                  <div>
                    <Label>Créée le</Label>
                    <div>{new Date(selectedImage.created).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Labels */}
              {Object.keys(selectedImage.labels).length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Labels</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedImage.labels).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              <div className="space-y-2">
                <h3 className="font-medium">Historique des modifications</h3>
                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {selectedImage.history.map((entry, index) => (
                    <div
                      key={index}
                      className="text-sm border rounded-lg p-2 space-y-1"
                    >
                      <div className="text-gray-500">
                        {new Date(entry.created).toLocaleString()}
                      </div>
                      <div className="font-mono text-xs">{entry.command}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
