'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ExternalLink, Star, Download, RefreshCw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface ImageSearchProps {
  mode: 'local' | 'hub';
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  onPullImage?: (imageName: string) => void;
}

interface DockerHubResult {
  name: string;
  description: string;
  stars: number;
  official: boolean;
  automated: boolean;
  pulls: number;
}

export default function ImageSearch({
  mode,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  onPullImage,
}: ImageSearchProps) {
  const [dockerHubResults, setDockerHubResults] = useState<DockerHubResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchDockerHub = async () => {
    if (!searchTerm) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/docker/search?term=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('Failed to search Docker Hub');
      const data = await response.json();
      setDockerHubResults(data);
    } catch (error) {
      console.error('Error searching Docker Hub:', error);
      setError('Failed to search Docker Hub. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDockerHubUrl = (imageName: string, official: boolean) => {
    if (official) {
      return `https://hub.docker.com/_/${imageName}`;
    }
    // Pour les images non officielles, on extrait le namespace/name
    const [namespace, name] = imageName.split('/');
    return name 
      ? `https://hub.docker.com/r/${namespace}/${name}`
      : `https://hub.docker.com/r/library/${namespace}`;
  };

  // Recherche locale
  if (mode === 'local') {
    return (
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search local images..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Recherche Docker Hub
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search Docker Hub..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchDockerHub()}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stars">Most Stars</SelectItem>
            <SelectItem value="pulls">Most Downloads</SelectItem>
            <SelectItem value="updated">Recently Updated</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={searchDockerHub} disabled={loading}>
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Search Hub
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        dockerHubResults.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {dockerHubResults.map((image) => (
              <Card key={image.name} className="hover:border-blue-500/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="font-mono text-sm">{image.name}</span>
                    {image.official && (
                      <Badge variant="default" className="bg-blue-500">
                        Official
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {image.description || 'No description available'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 mr-1 text-yellow-500" />
                      {image.stars.toLocaleString()}
                    </div>
                    <div className="flex items-center">
                      <Download className="h-4 w-4 mr-1" />
                      {image.pulls.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={getDockerHubUrl(image.name, image.official)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on Hub
                    </a>
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => onPullImage?.(image.name)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Pull Image
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      )}

      {!loading && !error && searchTerm && dockerHubResults.length === 0 && (
        <div className="text-center p-8 text-muted-foreground">
          No images found matching "{searchTerm}"
        </div>
      )}
    </div>
  );
}
