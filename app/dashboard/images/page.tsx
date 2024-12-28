'use client';

import { Container } from '@/components/ui/container';
import { ImageList } from '@/components/images/image-list';
import { PullImageDialog } from '@/components/images/pull-image-dialog';
import { useImages } from '@/hooks/use-images';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, SortDesc, Trash2, RefreshCw, HardDrive, Tag, Box, Clock, Database } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ImagesPage() {
  const { images, isLoading, error, refresh } = useImages();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterTag, setFilterTag] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Calculer les tags uniques pour le filtre
  const uniqueTags = useMemo(() => {
    const tags = new Set();
    images?.forEach(image => {
      if (image.RepoTags) {
        image.RepoTags.forEach(tag => tags.add(tag.split(':')[1]));
      }
    });
    return ['all', ...Array.from(tags)] as string[];
  }, [images]);

  // Statistiques des images
  const stats = useMemo(() => {
    if (!images) return { total: 0, size: 0, tags: 0, recent: 0 };
    
    const now = new Date();
    const recentImages = images.filter(img => {
      const created = new Date(img.Created);
      const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    });

    return {
      total: images.length,
      size: images.reduce((acc, img) => acc + (img.Size || 0), 0) / (1024 * 1024 * 1024),
      tags: uniqueTags.length - 1,
      recent: recentImages.length
    };
  }, [images, uniqueTags]);

  // Filtrer et trier les images
  const processedImages = useMemo(() => {
    let result = images || [];

    // Filtrage par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(image => 
        image.RepoTags?.[0]?.toLowerCase().includes(query) ||
        image.Id.toLowerCase().includes(query)
      );
    }

    // Filtrage par tag
    if (filterTag !== 'all') {
      result = result.filter(image => 
        image.RepoTags?.some(tag => tag.split(':')[1] === filterTag)
      );
    }

    // Tri
    return result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.Created).getTime() - new Date(a.Created).getTime();
        case 'oldest':
          return new Date(a.Created).getTime() - new Date(b.Created).getTime();
        case 'size':
          return b.Size - a.Size;
        case 'name':
          return (a.RepoTags?.[0] || '').localeCompare(b.RepoTags?.[0] || '');
        default:
          return 0;
      }
    });
  }, [images, searchQuery, filterTag, sortBy]);

  const handleRefresh = async () => {
    try {
      await refresh();
      toast({
        title: "Images rafraîchies",
        description: "La liste des images a été mise à jour.",
        className: "bg-zinc-900 border-blue-500/50",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de rafraîchir les images.",
        variant: "destructive",
      });
    }
  };

  const StatCard = ({ title, value, icon: Icon, gradient }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`${gradient} border-none shadow-lg backdrop-blur-sm`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-400">{title}</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                {value}
              </p>
            </div>
            <div className="p-2 rounded-full bg-black/20 backdrop-blur-sm border border-white/10">
              <Icon className="w-5 h-5 text-white/80" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <Container>
      <motion.div 
        className="flex flex-col gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header avec statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Images"
            value={stats.total}
            icon={Box}
            gradient="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900"
          />
          <StatCard
            title="Storage Used"
            value={`${stats.size.toFixed(2)} GB`}
            icon={HardDrive}
            gradient="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900"
          />
          <StatCard
            title="Unique Tags"
            value={stats.tags}
            icon={Tag}
            gradient="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900"
          />
          <StatCard
            title="Recent Images"
            value={stats.recent}
            icon={Clock}
            gradient="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900"
          />
        </div>

        {/* Barre d'outils */}
        <Card className="bg-gradient-to-br from-zinc-900 via-zinc-800/50 to-zinc-900 border-zinc-800/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Search images..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full bg-black/20 border-zinc-800 hover:border-blue-500/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-zinc-600 text-zinc-200 text-base rounded-md"
                />
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full md:w-40 bg-black/20 border-zinc-800 hover:border-blue-500/50">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="w-full md:w-40 bg-black/20 border-zinc-800 hover:border-blue-500/50">
                    <SelectValue placeholder="Filter by tag" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {uniqueTags.map(tag => (
                      <SelectItem key={tag} value={tag}>
                        {tag === 'all' ? 'All Tags' : tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRefresh}
                        className="border-zinc-800 hover:border-blue-500/50 bg-black/20"
                      >
                        <RefreshCw className="h-4 w-4 text-zinc-400" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-zinc-900 border-zinc-800">
                      <p>Refresh Images</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <PullImageDialog onSuccess={refresh} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des images */}
        <Card className="bg-gradient-to-br from-zinc-900 via-zinc-800/50 to-zinc-900 border-zinc-800/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full bg-zinc-800/50" />
                  ))}
                </motion.div>
              ) : error ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <p className="text-zinc-400">Une erreur est survenue lors du chargement des images.</p>
                  <Button
                    variant="outline"
                    onClick={refresh}
                    className="mt-4 border-zinc-800 hover:border-blue-500/50 bg-black/20"
                  >
                    Réessayer
                  </Button>
                </motion.div>
              ) : processedImages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <Database className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">Aucune image trouvée</p>
                </motion.div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <ImageList 
                    images={processedImages}
                    isLoading={isLoading}
                    error={error}
                    onRefresh={refresh}
                  />
                </ScrollArea>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </Container>
  );
}