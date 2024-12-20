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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  Plus,
  Terminal,
  Box,
  HardDrive,
  Cpu,
  Activity,
  Search,
  Filter,
  RefreshCcw,
  Settings2,
  Download,
  Upload,
} from 'lucide-react';

interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string[];
  created: string;
  cpu: number;
  memory: number;
  networks: string[];
}

interface ContainerLogs {
  timestamp: string;
  message: string;
  type: 'stdout' | 'stderr';
}

export default function ContainerManager() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [filter, setFilter] = useState({ status: 'all', search: '' });
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<ContainerLogs[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showNewContainer, setShowNewContainer] = useState(false);
  const [newContainer, setNewContainer] = useState({
    name: '',
    image: '',
    ports: '',
    env: '',
    volumes: '',
  });

  useEffect(() => {
    fetchContainers();
    if (autoRefresh) {
      const interval = setInterval(fetchContainers, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, filter]);

  const fetchContainers = async () => {
    try {
      const response = await fetch('/api/admin/containers?' + new URLSearchParams({
        status: filter.status,
        search: filter.search,
      }));
      
      if (response.ok) {
        const data = await response.json();
        setContainers(data);
      }
    } catch (error) {
      console.error('Error fetching containers:', error);
      toast.error('Erreur lors de la récupération des conteneurs');
    }
  };

  const handleContainerAction = async (containerId: string, action: string) => {
    try {
      const response = await fetch(`/api/admin/containers/${containerId}/${action}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast.success(`Action ${action} effectuée avec succès`);
        fetchContainers();
      }
    } catch (error) {
      console.error(`Error ${action} container:`, error);
      toast.error(`Erreur lors de l'action ${action}`);
    }
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
        toast.success('Conteneur créé avec succès');
        setShowNewContainer(false);
        setNewContainer({ name: '', image: '', ports: '', env: '', volumes: '' });
        fetchContainers();
      }
    } catch (error) {
      console.error('Error creating container:', error);
      toast.error('Erreur lors de la création du conteneur');
    }
  };

  const fetchContainerLogs = async (containerId: string) => {
    try {
      const response = await fetch(`/api/admin/containers/${containerId}/logs`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
        setShowLogs(true);
      }
    } catch (error) {
      console.error('Error fetching container logs:', error);
      toast.error('Erreur lors de la récupération des logs');
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['ID', 'Nom', 'Image', 'Status', 'État', 'Ports', 'Créé le', 'CPU', 'Mémoire', 'Réseaux'],
      ...containers.map(container => [
        container.id,
        container.name,
        container.image,
        container.status,
        container.state,
        container.ports.join(', '),
        container.created,
        `${container.cpu}%`,
        `${container.memory}%`,
        container.networks.join(', ')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `containers-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestion des conteneurs</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manuel'}
            </Button>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button onClick={() => setShowNewContainer(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau conteneur
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Status</Label>
              <Select
                value={filter.status}
                onValueChange={(value) => setFilter({ ...filter, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="running">En cours</SelectItem>
                  <SelectItem value="stopped">Arrêtés</SelectItem>
                  <SelectItem value="paused">En pause</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2 top-3 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-8"
                  placeholder="Rechercher..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Containers List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Mémoire</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {containers.map((container) => (
                <TableRow key={container.id}>
                  <TableCell className="font-medium">{container.name}</TableCell>
                  <TableCell>{container.image}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        container.state === 'running'
                          ? 'default'
                          : container.state === 'paused'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {container.state}
                    </Badge>
                  </TableCell>
                  <TableCell>{container.ports.join(', ')}</TableCell>
                  <TableCell>{container.cpu}%</TableCell>
                  <TableCell>{container.memory}%</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {container.state !== 'running' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleContainerAction(container.id, 'start')}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {container.state === 'running' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleContainerAction(container.id, 'stop')}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleContainerAction(container.id, 'restart')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchContainerLogs(container.id)}
                      >
                        <Terminal className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleContainerAction(container.id, 'remove')}
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

      {/* New Container Dialog */}
      <Dialog open={showNewContainer} onOpenChange={setShowNewContainer}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Créer un nouveau conteneur</DialogTitle>
            <DialogDescription>
              Configurez les paramètres du nouveau conteneur Docker.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom du conteneur</Label>
              <Input
                value={newContainer.name}
                onChange={(e) => setNewContainer({ ...newContainer, name: e.target.value })}
                placeholder="mon-conteneur"
              />
            </div>
            <div className="space-y-2">
              <Label>Image Docker</Label>
              <Input
                value={newContainer.image}
                onChange={(e) => setNewContainer({ ...newContainer, image: e.target.value })}
                placeholder="nginx:latest"
              />
            </div>
            <div className="space-y-2">
              <Label>Ports (host:container)</Label>
              <Input
                value={newContainer.ports}
                onChange={(e) => setNewContainer({ ...newContainer, ports: e.target.value })}
                placeholder="80:80, 443:443"
              />
            </div>
            <div className="space-y-2">
              <Label>Variables d'environnement</Label>
              <Input
                value={newContainer.env}
                onChange={(e) => setNewContainer({ ...newContainer, env: e.target.value })}
                placeholder="KEY=value,ANOTHER_KEY=value"
              />
            </div>
            <div className="space-y-2">
              <Label>Volumes</Label>
              <Input
                value={newContainer.volumes}
                onChange={(e) => setNewContainer({ ...newContainer, volumes: e.target.value })}
                placeholder="/host/path:/container/path"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewContainer(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateContainer}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Logs du conteneur</DialogTitle>
          </DialogHeader>
          <div className="h-[400px] overflow-auto bg-black rounded-md p-4 font-mono text-sm">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`${
                  log.type === 'stderr' ? 'text-red-400' : 'text-green-400'
                }`}
              >
                <span className="text-gray-500">{log.timestamp}</span>{' '}
                {log.message}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogs(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
