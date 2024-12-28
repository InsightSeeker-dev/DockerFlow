'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Network, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface NetworkContainer {
  id: string;
  name: string;
  ipv4Address: string;
  ipv6Address: string;
}

interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  ipam: {
    driver: string;
    config: Array<{
      subnet?: string;
      gateway?: string;
    }>;
  };
  containers: NetworkContainer[];
  options: Record<string, string>;
}

interface Container {
  id: string;
  name: string;
}

export default function NetworkManager() {
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<DockerNetwork | null>(
    null
  );
  const [availableContainers, setAvailableContainers] = useState<Container[]>([]);
  const [newNetwork, setNewNetwork] = useState({
    name: '',
    driver: 'bridge',
    subnet: '',
    gateway: '',
  });

  useEffect(() => {
    fetchNetworks();
    fetchAvailableContainers();
  }, []);

  const fetchNetworks = async () => {
    try {
      const response = await fetch('/api/admin/networks');
      if (response.ok) {
        const data = await response.json();
        setNetworks(data);
      } else {
        throw new Error('Failed to fetch networks');
      }
    } catch (error) {
      console.error('Failed to fetch networks:', error);
      toast.error('Failed to fetch networks');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableContainers = async () => {
    try {
      const response = await fetch('/api/admin/containers');
      if (response.ok) {
        const data = await response.json();
        setAvailableContainers(data);
      }
    } catch (error) {
      console.error('Failed to fetch containers:', error);
    }
  };

  const handleCreateNetwork = async () => {
    try {
      const response = await fetch('/api/admin/networks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newNetwork),
      });

      if (response.ok) {
        toast.success('Network created successfully');
        setIsCreateDialogOpen(false);
        setNewNetwork({
          name: '',
          driver: 'bridge',
          subnet: '',
          gateway: '',
        });
        fetchNetworks();
      } else {
        throw new Error('Failed to create network');
      }
    } catch (error) {
      console.error('Failed to create network:', error);
      toast.error('Failed to create network');
    }
  };

  const handleDeleteNetwork = async () => {
    if (!selectedNetwork) return;

    try {
      const response = await fetch(`/api/admin/networks/${selectedNetwork.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Network deleted successfully');
        setNetworks(networks.filter((net) => net.id !== selectedNetwork.id));
        setIsDeleteDialogOpen(false);
        setSelectedNetwork(null);
      } else {
        throw new Error('Failed to delete network');
      }
    } catch (error) {
      console.error('Failed to delete network:', error);
      toast.error('Failed to delete network');
    }
  };

  const confirmDelete = (network: DockerNetwork) => {
    setSelectedNetwork(network);
    setIsDeleteDialogOpen(true);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Network Management</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Network
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Subnet</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Connected Containers</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {networks.map((network) => (
              <TableRow key={network.id}>
                <TableCell>{network.name}</TableCell>
                <TableCell>{network.driver}</TableCell>
                <TableCell>{network.scope}</TableCell>
                <TableCell>
                  {network.ipam.config[0]?.subnet || 'N/A'}
                </TableCell>
                <TableCell>
                  {network.ipam.config[0]?.gateway || 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {network.containers.map((container) => (
                      <Badge key={container.id} variant="secondary">
                        {container.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => confirmDelete(network)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Network</DialogTitle>
            <DialogDescription>
              Create a new Docker network with the specified configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newNetwork.name}
                onChange={(e) =>
                  setNewNetwork({ ...newNetwork, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driver">Driver</Label>
              <Select
                value={newNetwork.driver}
                onValueChange={(value) =>
                  setNewNetwork({ ...newNetwork, driver: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bridge">Bridge</SelectItem>
                  <SelectItem value="host">Host</SelectItem>
                  <SelectItem value="overlay">Overlay</SelectItem>
                  <SelectItem value="macvlan">Macvlan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subnet">Subnet</Label>
              <Input
                id="subnet"
                value={newNetwork.subnet}
                onChange={(e) =>
                  setNewNetwork({ ...newNetwork, subnet: e.target.value })
                }
                placeholder="e.g., 172.20.0.0/16"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gateway">Gateway</Label>
              <Input
                id="gateway"
                value={newNetwork.gateway}
                onChange={(e) =>
                  setNewNetwork({ ...newNetwork, gateway: e.target.value })
                }
                placeholder="e.g., 172.20.0.1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNetwork}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Network</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this network? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteNetwork}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
