'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { ContainerCreation } from './container-creation';
import { ContainerLogs } from './container-logs';
import { StatusBadge } from './status-badge';
import { EmptyState } from './empty-state';
import { Container } from '@/lib/docker/types';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  RefreshCw, 
  Play, 
  Square, 
  RotateCw, 
  ScrollText, 
  Trash2,
  Box,
  Loader2,
  MoreVertical,
  ExternalLink
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ContainerListProps {
  containers: Container[];
  isLoading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onStart?: (id: string) => void;
  onStop?: (id: string) => void;
  onDelete?: (id: string) => void;
  onLogs?: (id: string) => void;
}

export function ContainerList({
  containers,
  isLoading,
  error,
  onRefresh,
  onStart,
  onStop,
  onDelete,
  onLogs,
}: ContainerListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  // Rafraîchir automatiquement toutes les 10 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing container list...');
      onRefresh();
    }, 10000);

    return () => clearInterval(interval);
  }, [onRefresh]);

  // Rafraîchir après la création d'un conteneur
  const handleCreateSuccess = useCallback(() => {
    console.log('Container created, refreshing list...');
    setShowCreateDialog(false);
    onRefresh();
  }, [onRefresh]);

  const handleAction = async (action: string, containerId: string) => {
    try {
      const response = await fetch(`/api/containers/${containerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform action');
      }

      onRefresh?.();
      toast({
        title: "Action réussie",
        description: `L'action ${action} a été effectuée avec succès.`,
      });
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      toast({
        title: "Erreur",
        description: `Impossible d'effectuer l'action ${action}.`,
        variant: "destructive",
      });
    }
  };

  // Filter and sort containers
  const filteredContainers = useMemo(() => {
    if (!Array.isArray(containers)) {
      console.error('Containers is not an array:', containers);
      return [];
    }
    
    return containers
      .filter((container) => {
        const name = container.Names[0].replace(/^\//, '');
        const image = container.Image;
        const searchLower = searchQuery.toLowerCase();
        
        // Filter by search query
        const matchesSearch = 
          name.toLowerCase().includes(searchLower) ||
          image.toLowerCase().includes(searchLower);

        // Filter by status
        const matchesStatus = 
          statusFilter === 'all' || 
          container.State.toLowerCase() === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => b.Created - a.Created);
  }, [containers, searchQuery, statusFilter]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header with refresh and create buttons - only visible when there are containers */}
      {Array.isArray(containers) && containers.length > 0 && (
        <div className="flex justify-end items-center">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onRefresh()}
              variant="outline"
              size="icon"
              className="relative dark:border-gray-700 dark:hover:bg-gray-800"
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un conteneur
            </Button>
          </div>
        </div>
      )}
      {/* Main content */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : !Array.isArray(containers) || containers.length === 0 ? (
        <EmptyState onCreateClick={() => setShowCreateDialog(true)} />
      ) : (
        // Container list with filters
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Rechercher un conteneur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-900 dark:border-gray-700">
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="running">En cours</SelectItem>
                <SelectItem value="exited">Arrêté</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Container list */}
          {filteredContainers.length > 0 ? (
            <div className="rounded-md border border-gray-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead className="text-gray-400">Nom</TableHead>
                    <TableHead className="text-gray-400">Image</TableHead>
                    <TableHead className="text-gray-400">Statut</TableHead>
                    <TableHead className="text-gray-400">Ports</TableHead>
                    <TableHead className="text-gray-400">Sous-domaine</TableHead>
                    <TableHead className="text-gray-400">Créé par</TableHead>
                    <TableHead className="text-gray-400">Créé le</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContainers.map((container) => {
                    const name = container.Names[0].replace(/^\//, '');
                    const isRunning = container.State === 'running';
                    const ports = container.customConfig?.ports || [];
                    const createdDate = new Date(container.Created * 1000).toLocaleString();
                    const subdomain = container.customConfig?.subdomain;
                    const user = container.user;
                    const traefikEnabled = container.traefik?.enabled;

                    return (
                      <TableRow key={container.Id} className="border-gray-800">
                        <TableCell className="font-medium text-gray-200">
                          {name}
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {container.Image}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={container.State} />
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {ports.map((port, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <span className="text-gray-500">host:</span>{port.hostPort}
                              <span className="text-gray-500">→</span>
                              <span className="text-gray-500">container:</span>{port.containerPort}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {subdomain && (
                            <div className="flex items-center gap-2">
                              <span>{subdomain}.dockersphere.ovh</span>
                              {traefikEnabled && (
                                <span className="text-xs bg-green-950 text-green-400 px-2 py-0.5 rounded">
                                  HTTPS
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400">
                          <div className="flex items-center gap-2">
                            <span>{user?.name || user?.email}</span>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded",
                              user?.role === 'ADMIN' 
                                ? "bg-purple-950 text-purple-400"
                                : "bg-blue-950 text-blue-400"
                            )}>
                              {user?.role}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {createdDate}
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-gray-400"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Actions du conteneur</p>
                                </TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end" className="w-56">
                                {container.State === 'running' && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => handleAction('stop', container.Id)}
                                      className="text-gray-200"
                                    >
                                      <Square className="mr-2 h-4 w-4 text-gray-500" />
                                      <div>
                                        <div>Arrêter</div>
                                        <span className="text-xs text-gray-400">
                                          Arrête le conteneur
                                        </span>
                                      </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleAction('restart', container.Id)}
                                      className="text-gray-200"
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4 text-blue-500" />
                                      <div>
                                        <div>Redémarrer</div>
                                        <span className="text-xs text-gray-400">
                                          Redémarre le conteneur
                                        </span>
                                      </div>
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {container.State !== 'running' && (
                                  <DropdownMenuItem
                                    onClick={() => handleAction('start', container.Id)}
                                    className="text-gray-200"
                                  >
                                    <Play className="mr-2 h-4 w-4 text-green-500" />
                                    <div>
                                      <div>Démarrer</div>
                                      <span className="text-xs text-gray-400">
                                        Démarre le conteneur
                                      </span>
                                    </div>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedContainerId(container.Id);
                                    onLogs?.(container.Id);
                                  }}
                                  className="text-gray-200"
                                >
                                  <ScrollText className="mr-2 h-4 w-4 text-blue-500" />
                                  <div>
                                    <div>Logs</div>
                                    <span className="text-xs text-gray-400">
                                      Affiche les journaux du conteneur
                                    </span>
                                  </div>
                                </DropdownMenuItem>
                                {subdomain && (
                                  <DropdownMenuItem asChild className="text-gray-200">
                                    <a
                                      href={`https://${subdomain}.dockersphere.ovh`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="mr-2 h-4 w-4 text-purple-500" />
                                      <div>
                                        <div>Accéder</div>
                                        <span className="text-xs text-gray-400">
                                          Ouvre l'interface web du conteneur
                                        </span>
                                      </div>
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleAction('remove', container.Id)}
                                  className="text-red-500 hover:text-red-400"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  <div>
                                    <div>Supprimer</div>
                                    <span className="text-xs opacity-75">
                                      Supprime le conteneur et ses données
                                    </span>
                                  </div>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex justify-center items-center h-64">
              <p className="text-gray-400">
                Aucun conteneur ne correspond à vos critères de recherche
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create container dialog */}
      <ContainerCreation
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />
      <ContainerLogs
        containerId={selectedContainerId}
        onClose={() => setSelectedContainerId(null)}
      />
    </div>
  );
}
