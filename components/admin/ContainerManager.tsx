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
}

interface ContainerLogs {
  timestamp: string;
  message: string;
  type: 'stdout' | 'stderr';
}

export default function ContainerManager() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(
    null
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [containerLogs, setContainerLogs] = useState<ContainerLogs[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newContainer, setNewContainer] = useState({
    name: '',
    image: '',
    ports: '',
    volumes: '',
    env: '',
  });

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

  const handleContainerAction = async (action: string, container: Container) => {
    try {
      const response = await fetch(`/api/admin/containers/${container.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        toast.success(`Container ${action} successful`);
        fetchContainers();
      } else {
        throw new Error(`Failed to ${action} container`);
      }
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      toast.error(`Failed to ${action} container`);
    }
  };

  const handleDeleteContainer = async () => {
    if (!selectedContainer) return;

    try {
      const response = await fetch(
        `/api/admin/containers/${selectedContainer.id}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        toast.success('Container deleted successfully');
        setContainers(
          containers.filter((c) => c.id !== selectedContainer.id)
        );
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

  const handleCreateContainer = async () => {
    try {
      const response = await fetch('/api/admin/containers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newContainer),
      });

      if (response.ok) {
        toast.success('Container created successfully');
        setIsCreateDialogOpen(false);
        setNewContainer({
          name: '',
          image: '',
          ports: '',
          volumes: '',
          env: '',
        });
        fetchContainers();
      } else {
        throw new Error('Failed to create container');
      }
    } catch (error) {
      console.error('Failed to create container:', error);
      toast.error('Failed to create container');
    }
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
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((container) => (
              <TableRow key={container.id}>
                <TableCell>{container.name}</TableCell>
                <TableCell>{container.imageId}</TableCell>
                <TableCell>
                  <Badge
                    className={getStatusColor(container.status)}
                    variant="secondary"
                  >
                    {container.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {Object.entries(container.ports).map(([port, target]) => (
                    <Badge key={port} variant="outline" className="mr-1">
                      {port}:{target}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>
                  {new Date(container.created).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          handleContainerAction('start', container)
                        }
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Start
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleContainerAction('stop', container)
                        }
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Stop
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleContainerAction('restart', container)
                        }
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Restart
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
              Are you sure you want to delete this container? This action cannot
              be undone.
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
            <DialogTitle>Create Container</DialogTitle>
            <DialogDescription>
              Create a new container with the specified configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newContainer.name}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image">Image</Label>
              <Input
                id="image"
                value={newContainer.image}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, image: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ports">Ports (e.g., 80:80,443:443)</Label>
              <Input
                id="ports"
                value={newContainer.ports}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, ports: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="volumes">
                Volumes (e.g., /host/path:/container/path)
              </Label>
              <Input
                id="volumes"
                value={newContainer.volumes}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, volumes: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="env">
                Environment Variables (e.g., KEY=value,OTHER=value)
              </Label>
              <Input
                id="env"
                value={newContainer.env}
                onChange={(e) =>
                  setNewContainer({ ...newContainer, env: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateContainer}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
