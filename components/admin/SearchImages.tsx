'use client';

import { useState } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SearchResult {
  name: string;
  description: string;
  stars: number;
  official: boolean;
  automated: boolean;
  pulls: number;
}

export function SearchImages() {
  const [searchTerm, setSearchTerm] = useState('');
  const [registry, setRegistry] = useState('dockerhub');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/docker/search?term=${searchTerm}&registry=${registry}`);
      if (!response.ok) throw new Error('Failed to search images');
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error searching images:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <Input
            placeholder="Search for Docker images..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Select value={registry} onValueChange={setRegistry}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Registry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dockerhub">Docker Hub</SelectItem>
            <SelectItem value="ghcr">GitHub Container Registry</SelectItem>
            <SelectItem value="custom">Custom Registry</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((image) => (
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