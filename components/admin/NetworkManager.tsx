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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<DockerNetwork | null>(null);
  
  const [createForm, setCreateForm] = useState({
    name: '',
    driver: 'bridge',
    internal: false,
    subnet: '',
    gateway: '',
  });

  const [connectForm, setConnectForm] = useState({
    networkId: '',
    containerId: '',
    ipv4Address: '',
    ipv6Address: '',
  });

  useEffect(() => {
    fetchNetworks();
    fetchContainers();
  }, []);

  const fetchNetworks = async () => {
    try {
      const response = await fetch('/api/admin/networks');
      if (!response.ok) throw new Error('Failed to fetch networks');
      const data = await response.json();
      setNetworks(data);
    } catch (error) {
      toast.error('Failed to fetch Docker networks');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContainers = async () => {
    try {
      const response = await fetch('/api/admin/containers');
      if (!response.ok) throw new Error('Failed to fetch containers');
      const data = await response.json();
      setContainers(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateNetwork = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/networks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) throw new Error('Failed to create network');
      
      toast.success('Network created successfully');
      setCreateDialogOpen(false);
      fetchNetworks();
    } catch (error) {
      toast.error('Failed to create network');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNetwork = async (networkId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/networks/${networkId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete network');
      
      toast.success('Network deleted successfully');
      fetchNetworks();
    } catch (error) {
      toast.error('Failed to delete network');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectContainer = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/networks/${connectForm.networkId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containerId: connectForm.containerId,
          ipv4Address: connectForm.ipv4Address,
          ipv6Address: connectForm.ipv6Address,
        }),
      });

      if (!response.ok) throw new Error('Failed to connect container');
      
      toast.success('Container connected successfully');
      setConnectDialogOpen(false);
      fetchNetworks();
    } catch (error) {
      toast.error('Failed to connect container');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectContainer = async (networkId: string, containerId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/networks/${networkId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId }),
      });

      if (!response.ok) throw new Error('Failed to disconnect container');
      
      toast.success('Container disconnected successfully');
      fetchNetworks();
    } catch (error) {
      toast.error('Failed to disconnect container');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Réseaux Docker</h2>
        <div className="space-x-4">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>Créer un réseau</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un réseau Docker</DialogTitle>
                <DialogDescription>
                  Configurez les paramètres du nouveau réseau.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nom</Label>
                  <Input
                    id="name"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="driver">Driver</Label>
                  <Select
                    value={createForm.driver}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, driver: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bridge">Bridge</SelectItem>
                      <SelectItem value="overlay">Overlay</SelectItem>
                      <SelectItem value="macvlan">Macvlan</SelectItem>
                      <SelectItem value="ipvlan">IPvlan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subnet">Subnet</Label>
                  <Input
                    id="subnet"
                    value={createForm.subnet}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, subnet: e.target.value })
                    }
                    placeholder="e.g., 172.20.0.0/16"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gateway">Gateway</Label>
                  <Input
                    id="gateway"
                    value={createForm.gateway}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, gateway: e.target.value })
                    }
                    placeholder="e.g., 172.20.0.1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleCreateNetwork}
                  disabled={!createForm.name}
                >
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Connecter un conteneur</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connecter un conteneur</DialogTitle>
                <DialogDescription>
                  Sélectionnez le réseau et le conteneur à connecter.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="network">Réseau</Label>
                  <Select
                    value={connectForm.networkId}
                    onValueChange={(value) =>
                      setConnectForm({ ...connectForm, networkId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un réseau" />
                    </SelectTrigger>
                    <SelectContent>
                      {networks.map((network) => (
                        <SelectItem key={network.id} value={network.id}>
                          {network.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="container">Conteneur</Label>
                  <Select
                    value={connectForm.containerId}
                    onValueChange={(value) =>
                      setConnectForm({ ...connectForm, containerId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un conteneur" />
                    </SelectTrigger>
                    <SelectContent>
                      {containers.map((container) => (
                        <SelectItem key={container.id} value={container.id}>
                          {container.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ipv4">IPv4 Address (optionnel)</Label>
                  <Input
                    id="ipv4"
                    value={connectForm.ipv4Address}
                    onChange={(e) =>
                      setConnectForm({
                        ...connectForm,
                        ipv4Address: e.target.value,
                      })
                    }
                    placeholder="e.g., 172.20.0.2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleConnectContainer}
                  disabled={!connectForm.networkId || !connectForm.containerId}
                >
                  Connecter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Subnet</TableHead>
              <TableHead>Conteneurs</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {networks.map((network) => (
              <TableRow key={network.id}>
                <TableCell>{network.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{network.driver}</Badge>
                </TableCell>
                <TableCell>{network.scope}</TableCell>
                <TableCell>
                  {network.ipam.config[0]?.subnet || 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {network.containers.map((container) => (
                      <Badge
                        key={container.id}
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() =>
                          handleDisconnectContainer(
                            network.id,
                            container.id
                          )
                        }
                      >
                        {container.name} ×
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedNetwork(network)}
                    >
                      Détails
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteNetwork(network.id)}
                      disabled={['bridge', 'host', 'none'].includes(network.name)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Network Details Dialog */}
      <Dialog open={!!selectedNetwork} onOpenChange={() => setSelectedNetwork(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Détails du réseau</DialogTitle>
          </DialogHeader>
          {selectedNetwork && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID</Label>
                  <div className="font-mono text-sm">{selectedNetwork.id}</div>
                </div>
                <div>
                  <Label>Driver</Label>
                  <div>{selectedNetwork.driver}</div>
                </div>
                <div>
                  <Label>Scope</Label>
                  <div>{selectedNetwork.scope}</div>
                </div>
                <div>
                  <Label>Internal</Label>
                  <div>{selectedNetwork.internal ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <div>
                <Label>IPAM Configuration</Label>
                <div className="space-y-2">
                  {selectedNetwork.ipam.config.map((config, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2">
                      {config.subnet && (
                        <div>
                          <span className="text-sm font-medium">Subnet:</span>{' '}
                          {config.subnet}
                        </div>
                      )}
                      {config.gateway && (
                        <div>
                          <span className="text-sm font-medium">Gateway:</span>{' '}
                          {config.gateway}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Options</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedNetwork.options).map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {key}: {value}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Conteneurs connectés</Label>
                <div className="space-y-2">
                  {selectedNetwork.containers.map((container) => (
                    <div
                      key={container.id}
                      className="flex justify-between items-center border p-2 rounded"
                    >
                      <div>
                        <div className="font-medium">{container.name}</div>
                        <div className="text-sm text-gray-500">
                          IPv4: {container.ipv4Address}
                          {container.ipv6Address && (
                            <>, IPv6: {container.ipv6Address}</>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDisconnectContainer(
                            selectedNetwork.id,
                            container.id
                          )
                        }
                      >
                        Déconnecter
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
