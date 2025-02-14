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
import { Search, ExternalLink } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ImageSearchProps {
  mode: 'local' | 'hub';
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
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
}: ImageSearchProps) {
  const [dockerHubResults, setDockerHubResults] = useState<DockerHubResult[]>([]);
  const [loading, setLoading] = useState(false);

  const searchDockerHub = async () => {
    if (!searchTerm) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/docker/search?term=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('Failed to search Docker Hub');
      const data = await response.json();
      setDockerHubResults(data);
    } catch (error) {
      console.error('Error searching Docker Hub:', error);
    } finally {
      setLoading(false);
    }
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
        <Button onClick={searchDockerHub} disabled={loading}>
          <Search className="h-4 w-4 mr-2" />
          Search Hub
        </Button>
      </div>

      {dockerHubResults.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {dockerHubResults.map((image) => (
            <Card key={image.name}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{image.name}</span>
                  {image.official && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Official
                    </span>
                  )}
                </CardTitle>
                <CardDescription>{image.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm">
                  <span>⭐ {image.stars}</span>
                  <span>📥 {image.pulls.toLocaleString()}</span>
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={`https://hub.docker.com/_/${image.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
