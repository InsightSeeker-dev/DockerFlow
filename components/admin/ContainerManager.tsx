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
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Image</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Subdomain</TableHeader>
              <TableHeader>Created</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {containers.map((container) => (
              <TableRow key={container.id}>
                <TableCell className="font-medium">{container.name}</TableCell>
                <TableCell>{container.imageId}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      container.status === 'running'
                        ? 'default'
                        : container.status === 'stopped'
                        ? 'secondary'
                        : 'destructive'
                    }
                    className={
                      container.status === 'running'
                        ? 'bg-green-500/10 text-green-500'
                        : container.status === 'stopped'
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-red-500/10 text-red-500'
                    }
                  >
                    {container.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {container.subdomain ? (
                    <a
                      href={`https://${container.subdomain}.dockersphere.ovh`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {container.subdomain}.dockersphere.ovh
                    </a>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {new Date(container.created).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleContainerAction(container.id, 'start')}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Start
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleContainerAction(container.id, 'stop')}
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Stop
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleViewLogs(container)}
                      >
                        <Terminal className="mr-2 h-4 w-4" />
                        View Logs
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
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
              <Input
                id="image"
                value={newContainer.image}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, image: e.target.value })
                }
                className="col-span-3"
              />
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
              <Input
                id="ports"
                value={newContainer.ports}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, ports: e.target.value })
                }
                className="col-span-3"
                placeholder="80:80, 443:443"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="volumes" className="text-right">
                Volumes
              </Label>
              <Input
                id="volumes"
                value={newContainer.volumes}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, volumes: e.target.value })
                }
                className="col-span-3"
                placeholder="/host/path:/container/path"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="env" className="text-right">
                Env
              </Label>
              <Input
                id="env"
                value={newContainer.env}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, env: e.target.value })
                }
                className="col-span-3"
                placeholder="KEY=value,ANOTHER_KEY=value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateContainer}>Create Container</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
