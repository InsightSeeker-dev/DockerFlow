'use client';

import { useState, useMemo } from 'react';
import { Container } from '@/lib/docker/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Play, Square, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw as RefreshIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  SortAsc as SortAscIcon,
  ExternalLink as ExternalLinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContainerListProps {
  containers: Container[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function ContainerList({
  containers,
  isLoading,
  error,
  onRefresh,
}: ContainerListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'created'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter and sort containers
  const filteredContainers = useMemo(() => {
    return containers
      .filter((container) => {
        const containerName = container.Names[0].replace(/^\//, '');
        const matchesSearch = containerName
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' || container.State.toLowerCase() === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'name':
            comparison = a.Names[0].localeCompare(b.Names[0]);
            break;
          case 'status':
            comparison = a.State.localeCompare(b.State);
            break;
          case 'created':
            comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [containers, searchQuery, statusFilter, sortBy, sortOrder]);

  const handleAction = async (containerId: string, action: 'start' | 'stop' | 'delete') => {
    try {
      setActionLoading(containerId);
      const response = await fetch(`/api/containers/${containerId}/${action}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      
      // Refresh the container list
      onRefresh();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  if (error) {
    return (
      <div className="text-red-500">
        Error: {error}
        <Button onClick={onRefresh} variant="outline" size="sm" className="ml-2">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <div>Loading containers...</div>;
  }

  if (filteredContainers.length === 0) {
    return <div>No containers found.</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search containers..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value)}
          >
            <SelectTrigger className="w-[130px]">
              <FilterIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="exited">Stopped</SelectItem>
              <SelectItem value="created">Created</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[130px]">
              <SortAscIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="created">Created</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <SortAscIcon
              className={cn('h-4 w-4 transition-transform', {
                'rotate-180': sortOrder === 'desc',
              })}
            />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            className="shrink-0"
          >
            <RefreshIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Image</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredContainers.map((container) => (
            <TableRow key={container.Id}>
              <TableCell>{container.Names[0].replace(/^\//, '')}</TableCell>
              <TableCell>
                <Badge variant={container.State.toLowerCase() === 'running' ? 'default' : 'secondary'}>
                  {container.State}
                </Badge>
              </TableCell>
              <TableCell>{container.Image}</TableCell>
              <TableCell>
                {container.State.toLowerCase() === 'running' && container.Labels && (
                  <a
                    href={`${container.Labels[`traefik.http.routers.${container.Names[0]?.replace('/', '')}.entrypoints`] === 'websecure' ? 'https' : 'http'}://${container.subdomain}.dockersphere.ovh`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <span className="flex items-center gap-1">
                      {container.subdomain}.dockersphere.ovh
                      <ExternalLinkIcon className="h-4 w-4" />
                    </span>
                  </a>
                )}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  {container.State.toLowerCase() !== 'running' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(container.Id, 'start')}
                      disabled={actionLoading === container.Id}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(container.Id, 'stop')}
                      disabled={actionLoading === container.Id}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(container.Id, 'delete')}
                    disabled={actionLoading === container.Id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}