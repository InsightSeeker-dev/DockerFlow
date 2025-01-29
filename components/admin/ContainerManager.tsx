import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { getImageVolumes } from '@/lib/docker/images';
import { 
  Loader2,
  Play,
  StopCircle,
  RefreshCw,
  Trash2,
  MoreHorizontal,
  Cpu,
  HardDrive as Memory,
  Network,
  Globe,
  Calendar,
  Box as BoxIcon,
} from 'lucide-react';
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
}

interface ContainerLogs {
  timestamp: string;
  message: string;
  type: 'stdout' | 'stderr';
}

interface AvailableImage {
  id: string;
  displayName: string;
  displayTag: string;
  RepoTags: string[];
  Created: string;
}

interface CreateContainerRequest {
  name: string;
  image: string;
  subdomain: string;
  ports: {
    PublicPort: number;
    PrivatePort: number;
    Type: string;
  }[];
  volumes: {
    name: string;
    mountPath: string;
  }[];
  env?: { key: string; value: string }[];
}

interface CreateContainerResponse {
  id: string;
  ports: ContainerPort[];
}

interface ContainerFormData {
  image: string;
  subdomain: string;
  env?: string;
}

export default function ContainerManager() {
  // États de base
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  // États pour la création de conteneur
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newContainer, setNewContainer] = useState<ContainerFormData>({
    image: '',
    subdomain: '',
    env: ''
  });

  // États pour la suppression et les logs
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [containerLogs, setContainerLogs] = useState<ContainerLogs[]>([]);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);

  // États pour la validation du sous-domaine
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);

  // Effet pour charger les conteneurs au montage
  useEffect(() => {
    console.log('Container Manager mounted');
    fetchContainers();
  }, []);

  // Effet pour charger les images disponibles quand le dialogue de création est ouvert
  useEffect(() => {
    if (isCreateDialogOpen) {
      fetchAvailableImages();
    }
  }, [isCreateDialogOpen]);

  const fetchContainers = async () => {
    try {
      console.log('Fetching containers...');
      setLoading(true);
      const response = await fetch('/api/admin/containers');
      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('API Response data:', data);
      
      if (response.ok) {
        if (!Array.isArray(data)) {
          console.log('Response is not an array:', data);
          setContainers([]);
          return;
        }
        console.log('Setting containers:', data);
        setContainers(data);
      } else {
        console.error('Failed to fetch containers:', data.error);
        toast.error('Failed to fetch containers');
      }
    } catch (error) {
      console.error('Error fetching containers:', error);
      toast.error('Failed to fetch containers');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableImages = async () => {
    try {
      setIsLoadingImages(true);
      const response = await fetch('/api/images');
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      const data = await response.json();
      setAvailableImages(data);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Failed to fetch available images');
    } finally {
      setIsLoadingImages(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading containers...</p>
        </div>
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="flex flex-col items-center gap-2">
          <BoxIcon className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No containers found</p>
          <p className="text-sm text-muted-foreground">Create a container to get started</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          Create Container
        </Button>
      </div>
    );
  }

  const handleContainerAction = async (containerId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await fetch(`/api/admin/containers/${containerId}/${action}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} container`);
      }

      toast.success(`Container ${action}ed successfully`);
      fetchContainers(); // Refresh the list
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
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

  const generateContainerName = () => {
    const prefix = 'container';
    const timestamp = Date.now().toString(36); 
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}_${timestamp}_${random}`;
  };

  const generateVolumeName = (containerName: string, purpose: string) => {
    return `${containerName}_${purpose}_vol`;
  };

  const findAvailablePort = async (startPort: number): Promise<number> => {
    try {
      const response = await fetch('/api/admin/ports/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startPort }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to check port availability');
      }
      
      const { port } = await response.json();
      return port;
    } catch (error) {
      console.error('Error checking port availability:', error);
      return Math.floor(Math.random() * (65535 - 10000) + 10000);
    }
  };

  const handleCreateContainer = async () => {
    try {
      setIsCreating(true);
      const toastId = toast.loading(
        <div className="space-y-2">
          <p className="font-semibold">Creating container...</p>
          <p className="text-sm text-gray-400">This may take a few moments</p>
        </div>
      );

      // Détecter les ports exposés de l'image via l'API
      const portsResponse = await fetch(`/api/images/ports?image=${encodeURIComponent(newContainer.image)}`);
      if (!portsResponse.ok) {
        throw new Error('Failed to detect exposed ports from image');
      }
      const { ports: exposedPorts } = await portsResponse.json();
      
      const defaultContainerPort = exposedPorts.length > 0 
        ? exposedPorts[0] 
        : 8080; // Port par défaut

      // Vérifier la disponibilité du port via l'API
      const portResponse = await fetch(`/api/ports/check?port=${defaultContainerPort}`);
      if (!portResponse.ok) {
        throw new Error(`Port ${defaultContainerPort} is not available`);
      }
      const { port: availablePort } = await portResponse.json();

      // Détecter les volumes de l'image via l'API
      const volumesResponse = await fetch(`/api/images/volumes?image=${encodeURIComponent(newContainer.image)}`);
      if (!volumesResponse.ok) {
        throw new Error('Failed to detect volumes from image');
      }
      const { volumes: imageVolumes } = await volumesResponse.json();
      
      const defaultVolumePath = imageVolumes.length > 0
        ? imageVolumes[0] 
        : '/data'; // Chemin par défaut

      // Préparer les données du conteneur
      const containerData: CreateContainerRequest = {
        name: newContainer.subdomain,
        image: newContainer.image,
        subdomain: newContainer.subdomain,
        ports: [{
          PublicPort: availablePort,
          PrivatePort: defaultContainerPort,
          Type: 'tcp'
        }],
        volumes: [
          {
            name: `${newContainer.subdomain}_data`,
            mountPath: defaultVolumePath
          }
        ],
        env: newContainer.env ? newContainer.env.split(',').map(pair => {
          const [key, value] = pair.trim().split('=');
          return { key, value };
        }) : []
      };

      const response = await fetch('/api/containers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(containerData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create container');
      }

      const result = await response.json() as CreateContainerResponse;
      const portMappings = result.ports.map((p: ContainerPort) => `${p.PublicPort}→${p.PrivatePort}`).join(', ');
      
      toast.success(
        <div className="space-y-2">
          <p className="font-semibold">Container created successfully! 🚀</p>
          <div className="text-sm space-y-1">
            <p>• Name: {newContainer.subdomain}</p>
            <p>• URL: https://{newContainer.subdomain}.dockersphere.ovh</p>
            <p>• Port mappings: {portMappings}</p>
            <p>• Volume: {defaultVolumePath}</p>
          </div>
        </div>,
        {
          duration: 5000
        }
      );

      setIsCreateDialogOpen(false);
      setNewContainer({
        image: '',
        subdomain: '',
        env: ''
      });
      fetchContainers();
    } catch (error: any) {
      console.error('Error creating container:', error);
      toast.error(
        <div className="space-y-2">
          <p className="font-semibold">Failed to create container ❌</p>
          <p className="text-sm text-red-200">{error.message || 'An unexpected error occurred'}</p>
          <p className="text-xs text-red-300">Please try again or contact support if the issue persists.</p>
        </div>,
        {
          duration: 5000
        }
      );
    } finally {
      setIsCreating(false);
    }
  };

  const formatPorts = (ports: ContainerPort[]) => {
    console.log('Formatting ports:', ports);
    if (!ports || ports.length === 0) return 'No ports';
    
    // Regrouper les ports par PrivatePort
    const groupedPorts = ports.reduce((acc, port) => {
      console.log('Processing port in formatPorts:', port);
      if (!port.PublicPort || !port.PrivatePort) return acc;
      
      const key = port.PrivatePort;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(port.PublicPort);
      return acc;
    }, {} as Record<number, number[]>);

    console.log('Grouped ports:', groupedPorts);

    // Si aucun port valide n'a été trouvé
    if (Object.keys(groupedPorts).length === 0) return 'No ports';

    // Formater chaque groupe de ports
    return Object.entries(groupedPorts).map(([privatePort, publicPorts]) => {
      // Si plusieurs hôtes mappent vers le même port conteneur
      if (publicPorts.length > 1) {
        return `${publicPorts.join(',')}→${privatePort}`;
      }
      // Si un seul hôte mappe vers ce port conteneur
      return `${publicPorts[0]}→${privatePort}`;
    }).join(' | ');
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

  const formatImageName = (image: AvailableImage) => {
    const name = image.displayName;
    const version = image.displayTag;
    const isOfficial = !name.includes('/') && !name.startsWith('sha256:');
    
    return {
      name: name.split('/').pop() || name,
      version,
      fullName: `${name}:${version}`,
      official: isOfficial
    };
  };

  const formatResource = (value: number | undefined | null, unlimited: boolean = false): string => {
    if (unlimited || !value || value === 0) return 'Unlimited';
    if (value < 1) return `${Math.round(value * 100)}%`;
    return value.toString();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Containers</h2>
          <p className="text-muted-foreground">
            {containers.length} container{containers.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          Create Container
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Resources</TableHead>
              <TableHead className="hidden md:table-cell">Ports</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Subdomain</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((container) => (
              <TableRow key={container.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      container.state === "running" ? "bg-green-500" :
                      container.state === "exited" ? "bg-red-500" :
                      "bg-yellow-500"
                    )} />
                    <span className="font-medium">{container.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{container.image}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      container.state === "running" ? "default" :
                      container.state === "exited" ? "destructive" :
                      "secondary"
                    }
                    className={cn(
                      container.state === "running" && "bg-green-500/10 text-green-500 border-green-500/20",
                      container.state === "exited" && "bg-red-500/10 text-red-500 border-red-500/20",
                      container.state === "paused" && "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    )}
                  >
                    {container.state}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span>{formatResource(container.cpuLimit)} CPU</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Memory className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {formatResource(container.memoryLimit)} {container.memoryLimit && container.memoryLimit > 0 ? 'MB' : ''}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm">
                      {formatPorts(container.ports)}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <span>{container.network || 'default'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {container.subdomain ? (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`https://${container.subdomain}.dockersphere.ovh`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {container.subdomain}
                      </a>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(container.created).toLocaleString()}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => handleContainerAction(container.id, 'start')}
                        disabled={container.state === 'running'}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Start
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleContainerAction(container.id, 'stop')}
                        disabled={container.state === 'exited'}
                      >
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleContainerAction(container.id, 'restart')}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Restart
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setSelectedContainer(container)}
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
      </div>

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
            <Button 
              variant="destructive" 
              onClick={async () => {
                if (!selectedContainer) return;
                try {
                  const response = await fetch(`/api/admin/containers/${selectedContainer.id}`, {
                    method: 'DELETE'
                  });
                  if (!response.ok) {
                    throw new Error('Failed to delete container');
                  }
                  toast.success('Container deleted successfully');
                  setIsDeleteDialogOpen(false);
                  fetchContainers();
                } catch (error) {
                  console.error('Error deleting container:', error);
                  toast.error('Failed to delete container');
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Container</DialogTitle>
            <DialogDescription>
              Create a new container with custom configuration
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="image" className="text-right">
                Image
              </Label>
              <div className="col-span-3">
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
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading images...</span>
                        </div>
                      </SelectItem>
                    ) : (
                      availableImages.map((image) => (
                        <SelectItem key={image.id} value={image.id}>
                          <div className="flex items-center gap-2">
                            <span>{image.displayName}</span>
                            <span className="text-muted-foreground">:{image.displayTag}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subdomain" className="text-right">
                Subdomain
              </Label>
              <div className="col-span-3">
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    placeholder="Enter subdomain"
                    value={newContainer.subdomain}
                    onChange={(e) =>
                      setNewContainer({ ...newContainer, subdomain: e.target.value })
                    }
                  />
                  <span className="text-muted-foreground">.dockersphere.ovh</span>
                </div>
                {subdomainError && (
                  <p className="text-sm text-red-500 mt-1">{subdomainError}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="env" className="text-right">
                Environment
              </Label>
              <div className="col-span-3">
                <Input
                  id="env"
                  placeholder="KEY=value,ANOTHER_KEY=value"
                  value={newContainer.env}
                  onChange={(e) =>
                    setNewContainer({ ...newContainer, env: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: KEY=value,ANOTHER_KEY=value
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateContainer}
              disabled={isCreating || !newContainer.image || !newContainer.subdomain}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Container'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
