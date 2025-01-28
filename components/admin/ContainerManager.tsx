'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Square,
  Trash2,
  RefreshCw,
  Plus,
  Terminal,
  Settings,
  MoreVertical,
  Cpu,
  HardDrive,
  Signal,
  ExternalLink,
  Network,
  Globe,
  Calendar,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface Container {
  id: string;
  name: string;
  imageId: string;
  status: string;
  ports: Record<string, any>;
  volumes: Record<string, any>;
  env: Record<string, any>;
  cpuLimit: number;
  memoryLimit: number;
  created: Date;
  userId: string;
  subdomain?: string;
}

interface ContainerLogs {
  timestamp: string;
  message: string;
  type: 'stdout' | 'stderr';
}

interface AvailableImage {
  id: string;
  tags: string[];
}

export default function ContainerManager() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [containerLogs, setContainerLogs] = useState<ContainerLogs[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newContainer, setNewContainer] = useState({
    name: '',
    image: '',
    subdomain: '',
    ports: '',
    volumes: '',
    env: '',
  });
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    try {
      const response = await fetch('/api/admin/containers');
      if (response.ok) {
        const data = await response.json();
        setContainers(data);
      } else {
        throw new Error('Failed to fetch containers');
      }
    } catch (error) {
      console.error('Failed to fetch containers:', error);
      toast.error('Failed to fetch containers');
    } finally {
      setLoading(false);
    }
  };

  const handleContainerAction = async (containerId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await fetch(`/api/admin/containers/${containerId}/${action}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} container`);
      }

      toast.success(`Container ${action}ed successfully`);
      fetchContainers();
    } catch (error) {
      console.error(`Error ${action}ing container:`, error);
      toast.error(`Failed to ${action} container`);
    }
  };

  const handleDeleteContainer = async () => {
    if (!selectedContainer) return;

    try {
      const response = await fetch(`/api/admin/containers/${selectedContainer.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Container deleted successfully');
        setContainers(containers.filter((c) => c.id !== selectedContainer.id));
        setIsDeleteDialogOpen(false);
        setSelectedContainer(null);
      } else {
        throw new Error('Failed to delete container');
      }
    } catch (error) {
      console.error('Failed to delete container:', error);
      toast.error('Failed to delete container');
    }
  };

  const fetchContainerLogs = async (containerId: string) => {
    try {
      const response = await fetch(`/api/admin/containers/${containerId}/logs`);
      if (response.ok) {
        const data = await response.json();
        setContainerLogs(data);
      } else {
        throw new Error('Failed to fetch container logs');
      }
    } catch (error) {
      console.error('Failed to fetch container logs:', error);
      toast.error('Failed to fetch container logs');
    }
  };

  const handleViewLogs = async (container: Container) => {
    setSelectedContainer(container);
    setIsLogsDialogOpen(true);
    await fetchContainerLogs(container.id);
  };

  const validateSubdomain = async (subdomain: string) => {
    if (!subdomain) {
      setSubdomainError('Subdomain is required');
      return false;
    }

    const subdomainRegex = /^[a-zA-Z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
      setSubdomainError('Subdomain can only contain letters, numbers, and hyphens');
      return false;
    }

    if (subdomain.length < 3 || subdomain.length > 63) {
      setSubdomainError('Subdomain must be between 3 and 63 characters');
      return false;
    }

    setIsCheckingSubdomain(true);
    try {
      const response = await fetch(`/api/admin/containers/check-subdomain?subdomain=${subdomain}`);
      const data = await response.json();
      
      if (!response.ok) {
        setSubdomainError(data.error || 'Subdomain is not available');
        return false;
      }
      
      setSubdomainError(null);
      return true;
    } catch (error) {
      setSubdomainError('Error checking subdomain availability');
      return false;
    } finally {
      setIsCheckingSubdomain(false);
    }
  };

  const handleCreateContainer = async () => {
    try {
      // Valider le nom
      if (!newContainer.name) {
        toast.error('Container name is required');
        return;
      }

      // Valider l'image
      if (!newContainer.image) {
        toast.error('Container image is required');
        return;
      }

      // Valider le sous-domaine
      const isSubdomainValid = await validateSubdomain(newContainer.subdomain);
      if (!isSubdomainValid) {
        return;
      }

      // Parser et valider les ports
      const parsedPorts = parsePortsString(newContainer.ports);
      if (newContainer.ports && parsedPorts.length === 0) {
        toast.error('Invalid ports format. Use format: hostPort:containerPort');
        return;
      }

      // Parser les volumes et variables d'environnement
      const parsedVolumes = parseVolumesString(newContainer.volumes);
      const parsedEnv = parseEnvString(newContainer.env);

      const response = await fetch('/api/admin/containers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newContainer.name,
          image: newContainer.image,
          subdomain: newContainer.subdomain,
          ports: parsedPorts,
          volumes: parsedVolumes,
          env: parsedEnv,
        }),
      });

      if (response.ok) {
        toast.success('Container created successfully');
        setIsCreateDialogOpen(false);
        setNewContainer({
          name: '',
          image: '',
          subdomain: '',
          ports: '',
          volumes: '',
          env: '',
        });
        fetchContainers();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create container');
      }
    } catch (error) {
      console.error('Error creating container:', error);
      toast.error('An error occurred while creating the container');
    }
  };

  const parsePortsString = (ports: string): [string, string][] => {
    if (!ports) return [];
    return ports.split(',')
      .map(pair => pair.trim())
      .filter(pair => pair.includes(':'))
      .map(pair => {
        const [host, container] = pair.split(':');
        return [host.trim(), container.trim()];
      });
  };

  const parseVolumesString = (volumes: string): [string, string][] => {
    if (!volumes) return [];
    return volumes.split(',')
      .map(pair => pair.trim())
      .filter(pair => pair.includes(':'))
      .map(pair => {
        const [host, container] = pair.split(':');
        return [host.trim(), container.trim()];
      });
  };

  const parseEnvString = (env: string): [string, string][] => {
    if (!env) return [];
    return env.split(',')
      .map(pair => pair.trim())
      .filter(pair => pair.includes('='))
      .map(pair => {
        const [key, value] = pair.split('=');
        return [key.trim(), value.trim()];
      });
  };

  const formatPort = (port: any) => {
    if (typeof port === 'object') {
      const { PrivatePort, PublicPort, Type } = port;
      return {
        privatePort: PrivatePort,
        publicPort: PublicPort,
        type: Type?.toLowerCase() || 'tcp'
      };
    }
    return { privatePort: port, publicPort: port, type: 'tcp' };
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'bg-green-500/10 text-green-500';
      case 'exited':
        return 'bg-red-500/10 text-red-500';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const fetchAvailableImages = async () => {
    setIsLoadingImages(true);
    try {
      const response = await fetch('/api/admin/images');
      if (response.ok) {
        const data = await response.json();
        setAvailableImages(data);
      } else {
        throw new Error('Failed to fetch images');
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
      toast.error('Failed to fetch available images');
    } finally {
      setIsLoadingImages(false);
    }
  };

  useEffect(() => {
    if (isCreateDialogOpen) {
      fetchAvailableImages();
    }
  }, [isCreateDialogOpen]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Container Management
        </h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Container
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Containers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Image</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-4 w-4" />
                      <span>Resources</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <div className="flex items-center space-x-2">
                      <Signal className="h-4 w-4" />
                      <span>Ports</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <div className="flex items-center space-x-2">
                      <Network className="h-4 w-4" />
                      <span>Network</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4" />
                      <span>Subdomain</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Created</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers.map((container) => (
                  <TableRow key={container.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <div className={`h-2 w-2 rounded-full ${
                          container.status === 'running' 
                            ? 'bg-green-500' 
                            : container.status === 'paused'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`} />
                        <span>{container.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{container.imageId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          container.status === 'running'
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : container.status === 'paused'
                            ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }
                      >
                        {container.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{container.cpuLimit || 'Unlimited'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {container.memoryLimit 
                              ? `${Math.round(container.memoryLimit / (1024 * 1024))}MB` 
                              : 'Unlimited'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        {Object.entries(container.ports || {}).map(([hostPort, containerPort], index) => {
                          const port = formatPort(containerPort);
                          return (
                            <div key={index} className="flex items-center space-x-2">
                              <Badge 
                                variant="outline" 
                                className="text-xs px-2 py-0 border-blue-200 bg-blue-50/50"
                              >
                                {port.type}
                              </Badge>
                              <span className="text-sm font-mono">
                                {port.publicPort}:{port.privatePort}
                              </span>
                            </div>
                          );
                        })}
                        {(!container.ports || Object.keys(container.ports).length === 0) && (
                          <span className="text-sm text-muted-foreground">No ports</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Signal className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">proxy</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {container.subdomain ? (
                        <a
                          href={`https://${container.subdomain}.dockersphere.ovh`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 text-blue-500 hover:text-blue-600"
                        >
                          <span className="text-sm">{container.subdomain}.dockersphere.ovh</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {new Date(container.created).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(container.created).toLocaleTimeString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleContainerAction(container.id, 'start')}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            <span>Start</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleContainerAction(container.id, 'stop')}
                          >
                            <Square className="mr-2 h-4 w-4" />
                            <span>Stop</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleContainerAction(container.id, 'restart')}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            <span>Restart</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewLogs(container)}>
                            <Terminal className="mr-2 h-4 w-4" />
                            <span>View Logs</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedContainer(container);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
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
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Container</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this container? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteContainer}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Container Logs</DialogTitle>
            <DialogDescription>
              Logs for container: {selectedContainer?.name}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            {containerLogs.map((log, index) => (
              <div
                key={index}
                className={`font-mono text-sm ${
                  log.type === 'stderr' ? 'text-red-500' : ''
                }`}
              >
                <span className="text-gray-500">{log.timestamp}</span>{' '}
                {log.message}
              </div>
            ))}
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setIsLogsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Container</DialogTitle>
            <DialogDescription>
              Create a new container with custom configuration
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newContainer.name}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, name: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="image" className="text-right">
                Image
              </Label>
              <div className="col-span-3 space-y-2">
                <Select
                  value={newContainer.image}
                  onValueChange={(value) =>
                    setNewContainer({ ...newContainer, image: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an image" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingImages ? (
                      <SelectItem value="loading" disabled>
                        Loading images...
                      </SelectItem>
                    ) : (
                      availableImages.map((image) => {
                        const displayName = image.tags && image.tags.length > 0 
                          ? image.tags[0] 
                          : image.id.substring(0, 12);
                        return (
                          <SelectItem key={image.id} value={image.id}>
                            <span className="font-mono">
                              {displayName}
                            </span>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                {newContainer.image && (
                  <p className="text-xs text-muted-foreground">
                    Selected image: {newContainer.image}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subdomain" className="text-right">
                Subdomain
              </Label>
              <div className="col-span-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    value={newContainer.subdomain}
                    onChange={(e) => {
                      setNewContainer({ ...newContainer, subdomain: e.target.value });
                      validateSubdomain(e.target.value);
                    }}
                    className="flex-1"
                    placeholder="myapp"
                    disabled={isCheckingSubdomain}
                  />
                  <span className="text-sm text-muted-foreground">.dockersphere.ovh</span>
                </div>
                {subdomainError && (
                  <p className="text-sm text-red-500">{subdomainError}</p>
                )}
                {isCheckingSubdomain && (
                  <p className="text-sm text-muted-foreground">Checking subdomain availability...</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ports" className="text-right">
                Ports
              </Label>
              <div className="col-span-3 space-y-2">
                <Input
                  id="ports"
                  value={newContainer.ports}
                  onChange={(e) =>
                    setNewContainer({ ...newContainer, ports: e.target.value })
                  }
                  placeholder="80:80, 443:443"
                  className="flex-1"
                />
                <p className="text-xs text-muted-foreground">
                  Format: hostPort:containerPort, comma separated (e.g., 80:80, 443:443)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="volumes" className="text-right">
                Volumes
              </Label>
              <div className="col-span-3 space-y-2">
                <Input
                  id="volumes"
                  value={newContainer.volumes}
                  onChange={(e) =>
                    setNewContainer({ ...newContainer, volumes: e.target.value })
                  }
                  placeholder="/host/path:/container/path"
                  className="flex-1"
                />
                <p className="text-xs text-muted-foreground">
                  Format: hostPath:containerPath, comma separated
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="env" className="text-right">
                Environment
              </Label>
              <div className="col-span-3 space-y-2">
                <Input
                  id="env"
                  value={newContainer.env}
                  onChange={(e) =>
                    setNewContainer({ ...newContainer, env: e.target.value })
                  }
                  placeholder="KEY=value,ANOTHER_KEY=value"
                  className="flex-1"
                />
                <p className="text-xs text-muted-foreground">
                  Format: KEY=value, comma separated
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewContainer({
                  name: '',
                  image: '',
                  subdomain: '',
                  ports: '',
                  volumes: '',
                  env: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateContainer}
              disabled={!newContainer.name || !newContainer.image || isCheckingSubdomain}
            >
              Create Container
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
