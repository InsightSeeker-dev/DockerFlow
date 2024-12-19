'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Network,
  RefreshCcw,
  Plus,
  Trash2,
  Settings,
  Link2,
  Unlink,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

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
  containers: Array<{
    id: string;
    name: string;
    ipv4Address?: string;
    ipv6Address?: string;
  }>;
  options: Record<string, string>;
}

interface NetworkFormData {
  name: string;
  driver: string;
  internal: boolean;
  subnet: string;
  gateway: string;
  options: Record<string, string>;
}

export default function NetworkManager() {
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<DockerNetwork | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<NetworkFormData>({
    name: '',
    driver: 'bridge',
    internal: false,
    subnet: '',
    gateway: '',
    options: {},
  });

  useEffect(() => {
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    try {
      const response = await fetch('/api/admin/networks');
      if (response.ok) {
        const data = await response.json();
        setNetworks(data);
      }
    } catch (error) {
      console.error('Error fetching networks:', error);
      toast.error('Erreur lors de la récupération des réseaux');
    }
  };

  const handleCreateNetwork = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/networks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Réseau créé avec succès');
        setShowCreate(false);
        setFormData({
          name: '',
          driver: 'bridge',
          internal: false,
          subnet: '',
          gateway: '',
          options: {},
        });
        fetchNetworks();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la création du réseau');
      }
    } catch (error) {
      console.error('Error creating network:', error);
      toast.error('Erreur lors de la création du réseau');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNetwork = async (networkId: string) => {
    try {
      const response = await fetch(`/api/admin/networks/${networkId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Réseau supprimé avec succès');
        fetchNetworks();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la suppression du réseau');
      }
    } catch (error) {
      console.error('Error deleting network:', error);
      toast.error('Erreur lors de la suppression du réseau');
    }
  };

  const handleConnectContainer = async (networkId: string, containerId: string) => {
    try {
      const response = await fetch(`/api/admin/networks/${networkId}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ containerId }),
      });

      if (response.ok) {
        toast.success('Conteneur connecté avec succès');
        fetchNetworks();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la connexion du conteneur');
      }
    } catch (error) {
      console.error('Error connecting container:', error);
      toast.error('Erreur lors de la connexion du conteneur');
    }
  };

  const handleDisconnectContainer = async (networkId: string, containerId: string) => {
    try {
      const response = await fetch(`/api/admin/networks/${networkId}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ containerId }),
      });

      if (response.ok) {
        toast.success('Conteneur déconnecté avec succès');
        fetchNetworks();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erreur lors de la déconnexion du conteneur');
      }
    } catch (error) {
      console.error('Error disconnecting container:', error);
      toast.error('Erreur lors de la déconnexion du conteneur');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Réseaux Docker</h2>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={fetchNetworks}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Réseau
          </Button>
        </div>
      </div>

      {/* Networks List */}
      <Card>
        <CardContent className="p-0">
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
                  <TableCell className="font-medium">{network.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      <Network className="h-3 w-3 mr-1" />
                      {network.driver}
                    </Badge>
                  </TableCell>
                  <TableCell>{network.scope}</TableCell>
                  <TableCell>
                    {network.ipam.config[0]?.subnet || 'N/A'}
                  </TableCell>
                  <TableCell>{network.containers.length}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedNetwork(network);
                          setShowDetails(true);
                        }}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteNetwork(network.id)}
                        disabled={network.name === 'bridge' || network.name === 'host' || network.name === 'none'}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Network Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Créer un nouveau réseau</DialogTitle>
            <DialogDescription>
              Configurez les paramètres du nouveau réseau Docker.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom du réseau</Label>
              <Input
                placeholder="mon-reseau"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Driver</Label>
              <Select
                value={formData.driver}
                onValueChange={(value) =>
                  setFormData({ ...formData, driver: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bridge">Bridge</SelectItem>
                  <SelectItem value="overlay">Overlay</SelectItem>
                  <SelectItem value="macvlan">Macvlan</SelectItem>
                  <SelectItem value="ipvlan">IPvlan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subnet</Label>
              <Input
                placeholder="172.18.0.0/16"
                value={formData.subnet}
                onChange={(e) =>
                  setFormData({ ...formData, subnet: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Gateway</Label>
              <Input
                placeholder="172.18.0.1"
                value={formData.gateway}
                onChange={(e) =>
                  setFormData({ ...formData, gateway: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateNetwork} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Network Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Détails du réseau</DialogTitle>
            {selectedNetwork && (
              <DialogDescription>
                {selectedNetwork.name} ({selectedNetwork.id.substring(0, 12)})
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedNetwork && (
            <div className="space-y-6">
              {/* Network Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Driver</Label>
                  <div className="mt-1">{selectedNetwork.driver}</div>
                </div>
                <div>
                  <Label>Scope</Label>
                  <div className="mt-1">{selectedNetwork.scope}</div>
                </div>
                <div>
                  <Label>Subnet</Label>
                  <div className="mt-1">
                    {selectedNetwork.ipam.config[0]?.subnet || 'N/A'}
                  </div>
                </div>
                <div>
                  <Label>Gateway</Label>
                  <div className="mt-1">
                    {selectedNetwork.ipam.config[0]?.gateway || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Connected Containers */}
              <div className="space-y-4">
                <h3 className="font-medium">Conteneurs connectés</h3>
                <div className="space-y-2">
                  {selectedNetwork.containers.map((container) => (
                    <div
                      key={container.id}
                      className="flex items-center justify-between p-2 bg-secondary rounded"
                    >
                      <div className="flex items-center">
                        <Link2 className="h-4 w-4 mr-2" />
                        <span className="font-medium">{container.name}</span>
                        {container.ipv4Address && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({container.ipv4Address})
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleDisconnectContainer(
                            selectedNetwork.id,
                            container.id
                          )
                        }
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Network Options */}
              {Object.keys(selectedNetwork.options).length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Options</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedNetwork.options).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
