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
import { StatusBadge, normalizeContainerState } from './status-badge';
import { EmptyState } from './empty-state';
import { Container, ContainerPort } from './types';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Play, 
  Square, 
  RotateCw, 
  ScrollText, 
  Trash2,
  Box,
  MoreVertical,
  ExternalLink
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [keepVolume, setKeepVolume] = useState(false);
  const [containerToDelete, setContainerToDelete] = useState<{ id: string, name: string } | null>(null);
  const { toast, dismiss } = useToast();

  
  // Rafraîchir après la création d'un conteneur
  const handleCreateSuccess = useCallback(() => {
    console.log('Container created, refreshing list...');
    setShowCreateDialog(false);
    onRefresh();
  }, [onRefresh]);

  const handleAction = async (action: string, containerId: string) => {
    // Trouver le conteneur dans la liste
    const container = containers.find(c => c.Id === containerId);
    if (!container) {
      toast({
        title: "Erreur",
        description: "Conteneur introuvable dans la liste actuelle.",
        variant: "destructive",
      });
      return;
    }

    // Récupérer le nom du conteneur (sans le slash initial)
    const containerName = container.Names[0].replace(/^\//, '');
    console.log(`[UI] Exécution de l'action ${action} sur le conteneur ${containerName} (ID: ${containerId})`);

    try {
      // Gestion spéciale pour l'action remove avec confirmation
      if (action === 'remove') {
        setContainerToDelete({
          id: containerId,
          name: containerName
        });
        setShowDeleteDialog(true);
        return;
      }

      // Afficher un toast de chargement
      const loadingToast = toast({
        title: "Action en cours",
        description: `Exécution de l'action ${action} sur ${containerName}...`,
        duration: 5000,
      });

      // Utiliser le nom du conteneur qui est garanti unique plutôt que l'ID
      const containerIdentifier = containerName;
      console.log(`[UI] Utilisation du nom de conteneur: ${containerIdentifier} pour l'action ${action}`);
      
      // Utiliser la route PATCH unifiée pour toutes les actions
      console.log(`[UI] Envoi de la requête PATCH à /api/containers/${containerIdentifier}`);
      console.log(`[UI] Paramètres de la requête:`, { 
        action
      });
      
      const response = await fetch(`/api/containers/${containerIdentifier}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action
        }),
      });
      
      console.log(`[UI] Réponse reçue avec statut: ${response.status}`);
      if (!response.ok) {
        console.error(`[UI] Erreur HTTP ${response.status} pour l'action ${action} sur ${containerIdentifier}`);
      }

      // Fermer le toast de chargement manuellement
      dismiss(loadingToast.id);

      // Gérer les erreurs HTTP
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[UI] Erreur HTTP ${response.status} pour l'action ${action}:`, errorData);
        
        // Gérer les cas spécifiques d'erreur
        if (response.status === 400 && errorData.currentState) {
          throw new Error(`Le conteneur est déjà dans l'état ${errorData.currentState}. Action ${action} impossible.`);
        } else {
          throw new Error(errorData.error || `Échec de l'action ${action}`);
        }
      }

      const result = await response.json();
      console.log(`[UI] Résultat de l'action ${action}:`, result);
      
      // Traitement spécial pour l'action 'access'
      if (action === 'access' && result.subdomain) {
        // Ouvrir l'interface web dans un nouvel onglet en utilisant le sous-domaine
        window.open(`https://${result.subdomain}.dockersphere.ovh`, '_blank');
      } else if (action === 'access' && result.ports) {
        // Fallback sur les ports exposés si pas de sous-domaine
        const port = Object.keys(result.ports)[0];
        if (port) {
          const hostPort = result.ports[port][0]?.HostPort;
          if (hostPort) {
            window.open(`http://localhost:${hostPort}`, '_blank');
          } else {
            throw new Error('Aucun port exposé disponible pour ce conteneur');
          }
        } else {
          throw new Error('Aucune interface web disponible pour ce conteneur');
        }
      }

      // Rafraîchir la liste des conteneurs immédiatement
      onRefresh?.();
      
      // Programmer un second rafraîchissement après un court délai
      // pour s'assurer que les changements d'état sont bien pris en compte
      setTimeout(() => {
        console.log(`[UI] Rafraîchissement différé après l'action ${action}`);
        onRefresh?.();
      }, 1000);
      
      // Afficher un message de succès
      toast({
        title: "Action réussie",
        description: result.message || `L'action ${action} a été effectuée avec succès sur ${containerName}.`,
      });
    } catch (error) {
      console.error(`[UI] Erreur lors de l'exécution de l'action ${action} sur ${containerName}:`, error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : `Impossible d'effectuer l'action ${action} sur ${containerName}.`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!containerToDelete) return;

    try {
      // Afficher un toast de chargement
      const loadingToast = toast({
        title: "Suppression en cours",
        description: `Suppression du conteneur ${containerToDelete.name}...`,
        duration: 5000,
      });

      console.log(`[UI] Suppression du conteneur ${containerToDelete.name} (ID: ${containerToDelete.id})`);
      console.log(`[UI] Paramètres: keepVolume=${keepVolume}`);

      // Utiliser la route PATCH unifiée pour l'action remove
      const containerIdentifier = containerToDelete.name; // Utiliser le nom du conteneur comme identifiant
      console.log(`[UI] Utilisation du nom de conteneur: ${containerIdentifier} pour l'action remove`);
      
      const response = await fetch(`/api/containers/${containerIdentifier}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'remove',
          keepVolume: keepVolume 
        }),
      });

      // Fermer le toast de chargement
      dismiss(loadingToast.id);

      console.log(`[UI] Réponse reçue avec statut: ${response.status}`);
      
      if (!response.ok) {
        const data = await response.json();
        console.error(`[UI] Erreur HTTP ${response.status} lors de la suppression du conteneur:`, data);
        throw new Error(data.error || 'Failed to delete container');
      }

      const data = await response.json();
      console.log('[UI] Conteneur supprimé avec succès:', data);
      
      // Rafraîchir la liste des conteneurs immédiatement
      onRefresh?.();
      
      // Programmer un second rafraîchissement après un court délai
      // pour s'assurer que les changements sont bien pris en compte
      setTimeout(() => {
        console.log(`[UI] Rafraîchissement différé après la suppression du conteneur ${containerToDelete.name}`);
        onRefresh?.();
      }, 1000);
      
      toast({
        title: "Conteneur supprimé",
        description: `Le conteneur ${containerToDelete.name} a été supprimé${keepVolume ? ' (volume conservé)' : ''}.`,
      });
    } catch (error) {
      console.error(`[UI] Erreur lors de la suppression du conteneur ${containerToDelete.name}:`, error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer le conteneur.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setContainerToDelete(null);
      setKeepVolume(false);
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

        // Filter by status - utiliser la fonction normalizeContainerState pour gérer tous les formats possibles
        const normalizedState = normalizeContainerState(container.State);
        const matchesStatus = statusFilter === 'all' || normalizedState === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => b.Created - a.Created);
  }, [containers, searchQuery, statusFilter]);

  return (
    <div className="container mx-auto p-4 xl:p-6 2xl:p-8 space-y-6 max-w-[2000px]">
      {/* Header with refresh and create buttons */}
      {Array.isArray(containers) && containers.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 lg:gap-6">
          {/* Filters */}
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-4 items-stretch sm:items-center lg:flex-1 xl:max-w-3xl">
            <Input
              placeholder="Rechercher un conteneur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-[250px] lg:w-[300px] xl:w-[400px] dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:placeholder-gray-400"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] lg:w-[200px] dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-900 dark:border-gray-700">
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="running">En cours</SelectItem>
                <SelectItem value="exited">Arrêté</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <Button
              onClick={() => onRefresh()}
              variant="outline"
              size="icon"
              className="relative dark:border-gray-700 dark:hover:bg-gray-800 h-10 w-10 lg:h-11 lg:w-11"
            >
              <LoadingSpinner size={20} color="#2563eb" className={isLoading ? '' : 'opacity-50'} />
            </Button>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium h-10 lg:h-11 lg:px-6"
            >
              <Plus className="h-4 w-4 lg:h-5 lg:w-5 mr-2" />
              <span className="hidden sm:inline">Créer un conteneur</span>
              <span className="sm:hidden">Créer</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main content */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={40} color="#2563eb" />
        </div>
      ) : !Array.isArray(containers) || containers.length === 0 ? (
        <EmptyState onCreateClick={() => setShowCreateDialog(true)} />
      ) : (
        <div className="space-y-6">
          {/* Desktop view - Table */}
          <div className="hidden md:block rounded-md border border-gray-800">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400 lg:py-4 xl:text-base">Nom</TableHead>
                  <TableHead className="text-gray-400 lg:py-4 xl:text-base">Image</TableHead>
                  <TableHead className="text-gray-400 lg:py-4 xl:text-base">Statut</TableHead>
                  <TableHead className="text-gray-400 lg:py-4 xl:text-base">Ports</TableHead>
                  <TableHead className="text-gray-400 lg:py-4 xl:text-base">Sous-domaine</TableHead>
                  <TableHead className="text-gray-400 lg:py-4 xl:text-base">Créé par</TableHead>
                  <TableHead className="text-gray-400 lg:py-4 xl:text-base">Créé le</TableHead>
                  <TableHead className="text-gray-400 lg:py-4 xl:text-base text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContainers.map((container) => {
                  const name = container.Names[0].replace(/^\//, '');
                  const isRunning = normalizeContainerState(container.State) === 'running';
                  const ports = container.customConfig?.ports || [];
                  const createdDate = new Date(container.Created * 1000).toLocaleString();
                  const subdomain =
                    container.customConfig?.subdomain ||
                    container.subdomain ||
                    (container.Names && container.Names[0]?.replace(/^\//, '')) ||
                    '';
                  const user = container.user;
                  const traefikEnabled = container.traefik?.enabled;

                  return (
                    <TableRow key={container.Id} className="border-gray-800">
                      <TableCell className="font-medium text-gray-200 lg:py-4 xl:text-base">
                        {name}
                      </TableCell>
                      <TableCell className="text-gray-400 lg:py-4 xl:text-base">
                        {container.Image}
                      </TableCell>
                      <TableCell className="lg:py-4 xl:text-base">
                        <StatusBadge status={container.State} />
                      </TableCell>
                      <TableCell className="text-gray-400 lg:py-4 xl:text-base">
                        {Array.isArray(container.Ports) && container.Ports.map((port: ContainerPort, index: number) => {
                          // Si le conteneur utilise Traefik, il a HTTPS activé
                          const isTraefikEnabled = container.Labels && Object.keys(container.Labels).some(label => label.startsWith('traefik.enable'));
                          if (isTraefikEnabled) {
                            return (
                              <div key={index} className="flex items-center gap-1">
                                <span className="text-xs bg-green-950 text-green-400 px-2 py-0.5 rounded">
                                  HTTPS
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div key={index} className="flex items-center gap-1 text-gray-400">
                              <span className="text-gray-500">host:</span> {port.hostPort || port.PublicPort}
                              <span className="text-gray-500">→</span>
                              <span className="text-gray-500">container:</span> {port.containerPort || port.PrivatePort}
                            </div>
                          );
                        })}
                      </TableCell>
                      <TableCell className="text-gray-400 lg:py-4 xl:text-base">
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
                      <TableCell className="text-gray-400 lg:py-4 xl:text-base">
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
                      <TableCell className="text-gray-400 lg:py-4 xl:text-base">
                        {createdDate}
                      </TableCell>
                      <TableCell className="text-right lg:py-4 xl:text-base">
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
                                    <LoadingSpinner size={16} color="#2563eb" className="mr-2" />
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
                              {(() => { console.log('Affichage subdomain (dropdown):', subdomain, container); return null })()}
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

          {/* Mobile view - Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:hidden gap-4">
            {filteredContainers.map((container) => {
              const name = container.Names[0].replace(/^\//, '');
              const isRunning = container.State === 'running';
              const ports = container.customConfig?.ports || [];
              const createdDate = new Date(container.Created * 1000).toLocaleString();
              const subdomain = container.customConfig?.subdomain || container.subdomain;
              const user = container.user;
              const traefikEnabled = container.traefik?.enabled;

              return (
                <div key={container.Id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-200">{name}</h3>
                      <p className="text-sm text-gray-400">{container.Image}</p>
                    </div>
                    <StatusBadge status={container.State} />
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    {ports.length > 0 && (
                      <div>
                        <span className="text-gray-400">Ports:</span>
                        <div className="mt-1 space-y-1">
                          {ports.map((port, index) => (
                            <div key={index} className="text-gray-300">
                              {port.hostPort} → {port.containerPort}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {subdomain && (
                      <div>
                        <span className="text-gray-400">Sous-domaine:</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-gray-300">{subdomain}.dockersphere.ovh</span>
                          {traefikEnabled && (
                            <span className="text-xs bg-green-950 text-green-400 px-2 py-0.5 rounded">
                              HTTPS
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-gray-400">Créé par:</span>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-gray-300">{user?.name || user?.email}</span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded",
                          user?.role === 'ADMIN' 
                            ? "bg-purple-950 text-purple-400"
                            : "bg-blue-950 text-blue-400"
                        )}>
                          {user?.role}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-400">Créé le:</span>
                      <div className="mt-1 text-gray-300">{createdDate}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                    {isRunning ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction('stop', container.Id)}
                          className="text-gray-200"
                        >
                          <Square className="h-4 w-4 mr-2 text-gray-500" />
                          Arrêter
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction('restart', container.Id)}
                          className="text-gray-200"
                        >
                          <LoadingSpinner size={16} color="#2563eb" className="mr-2" />
                          Redémarrer
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction('start', container.Id)}
                        className="text-gray-200"
                      >
                        <Play className="h-4 w-4 mr-2 text-green-500" />
                        Démarrer
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleAction('remove', container.Id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce conteneur ?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Cette action supprimera le conteneur <span className="font-medium">{containerToDelete?.name}</span>.</p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keepVolume"
                  checked={keepVolume}
                  onCheckedChange={(checked) => setKeepVolume(checked as boolean)}
                />
                <label
                  htmlFor="keepVolume"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Conserver le volume et ses données pour une utilisation ultérieure
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setContainerToDelete(null);
              setKeepVolume(false);
            }}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs */}
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
