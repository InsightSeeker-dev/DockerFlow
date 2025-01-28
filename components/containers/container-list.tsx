// /DockerFlow/components/containers/container-list.tsx
'use client';

import { useState, useMemo } from 'react';
import { Container } from '@/lib/docker/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Search as SearchIcon,
  Filter as FilterIcon,
  SortAsc as SortAscIcon,
  ExternalLink as ExternalLinkIcon,
  Play,
  Square,
  Trash2,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ContainerDetails } from './container-details';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

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
            comparison = a.Created - b.Created;
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [containers, searchQuery, statusFilter, sortBy, sortOrder]);

  const handleAction = async (containerId: string, action: 'start' | 'stop' | 'delete') => {
    if (action === 'delete' && !window.confirm('Êtes-vous sûr de vouloir supprimer ce conteneur ?')) {
      return;
    }

    try {
      setActionLoading(containerId);
      const response = await fetch(`/api/containers/${containerId}/${action}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} container`);
      }
      
      onRefresh();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 border-2 border-red-200 rounded-lg bg-red-50 dark:border-red-800 dark:bg-red-950">
        <div className="text-red-500">
          <span className="font-semibold">Erreur:</span> {error}
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-lg text-muted-foreground">Chargement des conteneurs...</p>
      </div>
    );
  }

  if (filteredContainers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 border-2 border-dashed rounded-lg">
        <div className="p-4 rounded-full bg-muted">
          <Box className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">Aucun conteneur trouvé</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery || statusFilter !== 'all' 
              ? "Aucun conteneur ne correspond à vos critères de recherche" 
              : "Commencez par créer un nouveau conteneur"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Dialog open={!!selectedContainer} onOpenChange={() => setSelectedContainer(null)}>
        <DialogContent className="max-w-4xl">
          {selectedContainer && (
            <ContainerDetails
              containerId={selectedContainer}
              onClose={() => setSelectedContainer(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Rechercher des conteneurs..."
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
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="running">En cours</SelectItem>
              <SelectItem value="exited">Arrêtés</SelectItem>
              <SelectItem value="created">Créés</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[130px]">
              <SortAscIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="status">Statut</SelectItem>
              <SelectItem value="created">Date de création</SelectItem>
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onRefresh}
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rafraîchir la liste</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Nom</TableHead>
              <TableHead className="w-[100px]">Statut</TableHead>
              <TableHead>Image</TableHead>
              <TableHead className="w-[150px]">Créé le</TableHead>
              <TableHead className="w-[120px]">Ports</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContainers.map((container) => (
              <TableRow 
                key={container.Id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedContainer(container.Id)}
              >
                <TableCell className="font-medium">
                  {container.Names[0].replace(/^\//, '')}
                </TableCell>
                <TableCell>
                  <StatusBadge status={container.State} />
                </TableCell>
                <TableCell className="font-mono text-sm truncate max-w-[200px]">
                  {container.Image}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(container.Created * 1000).toLocaleString('fr-FR')}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {container.Ports?.length > 0 
                    ? container.Ports.map(port => 
                        `${port.PublicPort}:${port.PrivatePort}`
                      ).join(', ')
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  {container.State.toLowerCase() === 'running' && container.subdomain && (
                    <a
                      href={`http://${container.subdomain}.dockersphere.ovh`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {container.subdomain}.dockersphere.ovh
                      <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <TooltipProvider>
                      {container.State.toLowerCase() !== 'running' ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(container.Id, 'start')}
                              disabled={actionLoading === container.Id}
                            >
                              {actionLoading === container.Id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Démarrer le conteneur</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(container.Id, 'stop')}
                              disabled={actionLoading === container.Id}
                            >
                              {actionLoading === container.Id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Arrêter le conteneur</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(container.Id, 'delete')}
                            disabled={actionLoading === container.Id}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            {actionLoading === container.Id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Supprimer le conteneur</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
