'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContainerCreation } from '@/components/containers';
import { MoreHorizontal, Play, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ContainerPort {
  IP: string;
  PrivatePort: number;
  PublicPort: number;
  Type: string;
}

interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: string;
  ports: ContainerPort[];
  stats: any;
  network?: string;
  subdomain?: string;
  cpuLimit?: number;
  memoryLimit?: number;
  fullHostname?: string;
}

interface ContainerListProps {
  title?: string;
}

export function ContainerList({ title = "Your Containers" }: ContainerListProps) {
  const [containers, setContainers] = React.useState<Container[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Timeout de refresh manuel (scope global au composant)
  const refreshTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const fetchContainers = async (refreshType?: 'manual' | 'auto') => {
    try {
      if (refreshType === 'manual') {
        setIsRefreshing(true);
        console.log('[ContainerList] Début refresh manuel, isRefreshing -> true');
        // Timeout de sécurité : 15 secondes
        refreshTimeoutRef.current = setTimeout(() => {
          setIsRefreshing(false);
          console.warn('[ContainerList] Forçage du reset isRefreshing suite à timeout');
        }, 15000);
      } else {
        setIsLoading(true);
      }
      const response = await fetch('/api/admin/containers');
      if (!response.ok) throw new Error('Failed to fetch containers');
      const data = await response.json();
      setContainers(data);
    } catch (error) {
      console.error('Error fetching containers:', error);
      alert('Erreur lors du rafraîchissement des containers.');
    } finally {
      if (refreshType === 'manual') {
        setIsRefreshing(false);
        console.log('[ContainerList] Fin refresh manuel, isRefreshing -> false');
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
          refreshTimeoutRef.current = null;
          console.log('[ContainerList] Reset isRefreshing normalement');
        }
      } else {
        setIsLoading(false);
      }
    }
  };

  // Nettoyage du timeout si le composant est démonté pendant un refresh manuel
  React.useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
        console.warn('[ContainerList] Cleanup du timeout de refresh manuel au démontage');
      }
    };
  }, []);

  // Empêche isRefreshing et isLoading d'être à true en même temps
  React.useEffect(() => {
    if (isRefreshing && isLoading) {
      setIsRefreshing(false);
      console.warn('[ContainerList] Correction automatique : isRefreshing && isLoading tous les deux à true');
    }
  }, [isRefreshing, isLoading]);

  React.useEffect(() => {
    console.log('[ContainerList] useEffect mount');
    fetchContainers();
    const interval = setInterval(() => {
      fetchContainers();
    }, 60000); // auto-refresh toutes les 60s
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (containerId: string, action: 'start' | 'restart' | 'delete') => {
    try {
      setActionLoading(containerId);
      const response = await fetch(`/api/containers/${containerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(`Failed to ${action} container`);
      fetchContainers();
    } catch (error) {
      console.error(`Error ${action}ing container:`, error);
      alert(`Erreur lors de l'action ${action} sur le container. Veuillez réessayer.`);
      fetchContainers(); // force le refresh même après erreur
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              console.log('[ContainerList] Bouton refresh cliqué. isRefreshing:', isRefreshing, 'isLoading:', isLoading);
              if (!isRefreshing && !isLoading) fetchContainers('manual');
            }}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw className={`h-6 w-6 ${isRefreshing ? 'animate-spin' : ''} text-blue-400`} />
          </Button>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            + Create Container
          </Button>
        </div>
      </div>

      {containers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="h-12 w-12 text-gray-400 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center">
            <MoreHorizontal className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium text-gray-200">No containers found</h3>
          <p className="text-sm text-gray-400">Get started by creating your first container</p>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            variant="outline"
            className="border-gray-700 hover:bg-gray-800"
          >
            Create Container
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">Name</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Ports</TableHead>
                <TableHead className="text-gray-400">Subdomain</TableHead>
                <TableHead className="text-gray-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {containers.map((container) => (
                <TableRow key={container.id} className="border-gray-800 hover:bg-gray-900/50">
                  <TableCell className="font-medium text-gray-200">
                    {container.name}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={container.state === 'running' ? 'default' : 'destructive'}
                      className={cn(
                        "bg-opacity-10",
                        container.state === 'running' ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'
                      )}
                    >
                      {container.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-400">
                    {container.ports?.length ? 
                      container.ports.map(p => `${p.PublicPort}:${p.PrivatePort}`).join(', ') : 
                      'No ports'
                    }
                  </TableCell>
                  <TableCell className="text-gray-400">
                    {container.subdomain ? (
                      <a 
                        href={`https://${container.subdomain}.dockersphere.ovh`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {container.subdomain}
                      </a>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#0B1120] border-gray-800">
                        <DropdownMenuItem
                          className="text-green-500 focus:text-green-400 focus:bg-green-500/10"
                          onClick={() => handleAction(container.id, 'start')}
                          disabled={actionLoading === container.id}
                        >
                          {actionLoading === container.id ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="mr-2 h-4 w-4" />
                          )}
                          <span>Start</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500 focus:text-red-400 focus:bg-red-500/10"
                          onClick={() => handleAction(container.id, 'delete')}
                          disabled={actionLoading === container.id}
                        >
                          {actionLoading === container.id ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ContainerCreation
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={fetchContainers}
      />
    </div>
  );
}
