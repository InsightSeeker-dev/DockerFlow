'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ContainerList } from '../containers/container-list';
import { ContainerLogs } from '../containers/container-logs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VolumeManager } from '../volumes/volume-manager';
import { Container } from '@/components/containers/types';
import ImageManager from './ImageManager';
import NetworkManager from './NetworkManager';
import AlertCenter from './AlertCenter';
import AdminSettings from './AdminSettings';
import { UserManager } from './UserManager';
import { DashboardOverview } from './DashboardOverview';
import { getSystemStats } from '@/lib/api';
import { SystemStats } from '@/types/system';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  Container as ContainerIcon,
  Image as ImageIcon,
  Terminal as TerminalIcon,
  Bell,
  Settings,
  Users,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Minimize2,
  Database
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import dynamic from 'next/dynamic';

const WebTerminal = dynamic(
  () => import('@/components/terminal/WebTerminal').then(mod => mod.default),
  { ssr: false }
);

// Nous utilisons directement le type Container du composant ContainerList

interface RecentActivity {
  id: string;
  type: 'user' | 'container' | 'system';
  action: string;
  description: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTerminals, setActiveTerminals] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [maximizedTerminal, setMaximizedTerminal] = useState<string | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    containers: 0,
    containersRunning: 0,
    containersStopped: 0,
    containersError: 0,
    containerTrend: 0,
    
    images: {
      total: 0,
      size: 0,
      pulls: 0,
      tags: []
    },
    
    totalUsers: 0,
    activeUsers: 0,
    newUsers: 0,
    suspendedUsers: 0,
    userTrend: 0,
    
    cpuUsage: 0,
    cpuCount: 0,
    cpuTrend: 0,
    
    memoryUsage: {
      used: 0,
      total: 0,
      free: 0,
      percentage: 0
    },
    memoryTrend: 0,
    
    diskUsage: {
      used: 0,
      total: 0,
      free: 0,
      percentage: 0
    },
    
    networkTraffic: {
      in: 0,
      out: 0
    },

    performanceHistory: []
  });
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const { toast } = useToast();
  
  const fetchContainers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/containers');
      if (!response.ok) {
        throw new Error('Failed to fetch containers');
      }
      const data = await response.json();
      setContainers(data.map((container: any) => ({
        ...container,
        dockerId: container.Id,
        Name: container.Names[0]?.replace(/^\//, '') || '',
        url: `https://${container.Labels['traefik.frontend.rule']?.split('Host:`')[1]?.split('`')[0] || ''}`,
        subdomain: container.Labels['traefik.frontend.rule']?.split('Host:`')[1]?.split('`')[0]?.split('.')[0] || '',
        cpuLimit: parseInt(container.Labels['cpu.limit'] || '0'),
        memoryLimit: parseInt(container.Labels['memory.limit'] || '0'),
        userId: container.Labels['com.docker.compose.project'] || '',
        customConfig: {
          subdomain: container.Labels['traefik.frontend.rule']?.split('Host:`')[1]?.split('`')[0]?.split('.')[0] || '',
          ports: container.Ports.map((port: any) => ({
            ...port,
            hostPort: port.PublicPort,
            containerPort: port.PrivatePort
          })),
          cpuLimit: parseInt(container.Labels['cpu.limit'] || '0'),
          memoryLimit: parseInt(container.Labels['memory.limit'] || '0')
        }
      })));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching containers';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await getSystemStats();
        setSystemStats(stats);
        setError(null);
      } catch (error) {
        console.error('Error fetching system stats:', error);
        toast({
          title: 'Error',
          description: 'Failed to load system statistics',
          variant: 'destructive',
        });
      }
    };

    // Fetch initial stats
    fetchStats();

    // Update stats every 5 seconds
    const interval = setInterval(fetchStats, 5000);

    return () => clearInterval(interval);
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'containers') {
      fetchContainers();
    }
  }, [activeTab]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <motion.div 
          className="flex items-center"
          whileHover={{ scale: 1.05 }}
        >
          <ContainerIcon className="text-blue-500 mr-3" size={40} />
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
              DockerFlow
            </h1>
            <span className="text-xs font-semibold text-blue-400 ml-1">
              Admin
            </span>
          </div>
        </motion.div>
        <Button 
          variant="destructive" 
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="containers" className="flex items-center gap-2">
            <ContainerIcon className="h-4 w-4" />
            <span>Containers</span>
          </TabsTrigger>
          <TabsTrigger value="volumes" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span>Volumes</span>
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            <span>Images</span>
          </TabsTrigger>
          <TabsTrigger value="terminal" className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4" />
            <span>Terminal</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <DashboardOverview 
            systemStats={systemStats}
            recentActivities={recentActivities}
          />
        </TabsContent>

        <TabsContent value="containers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Container Management</CardTitle>
            </CardHeader>
            <CardContent>
              <ContainerList 
                containers={containers}
                isLoading={isLoading}
                error={error}
                onRefresh={fetchContainers}
                onStart={async (id) => {
                  try {
                    const response = await fetch(`/api/containers/${id}/start`, { method: 'POST' });
                    if (!response.ok) throw new Error('Failed to start container');
                    fetchContainers();
                    toast({
                      title: 'Succès',
                      description: 'Le conteneur a été démarré',
                    });
                  } catch (error) {
                    toast({
                      title: 'Erreur',
                      description: 'Impossible de démarrer le conteneur',
                      variant: 'destructive',
                    });
                  }
                }}
                onStop={async (id) => {
                  try {
                    const response = await fetch(`/api/containers/${id}/stop`, { method: 'POST' });
                    if (!response.ok) throw new Error('Failed to stop container');
                    fetchContainers();
                    toast({
                      title: 'Succès',
                      description: 'Le conteneur a été arrêté',
                    });
                  } catch (error) {
                    toast({
                      title: 'Erreur',
                      description: 'Impossible d\'arrêter le conteneur',
                      variant: 'destructive',
                    });
                  }
                }}
                onDelete={async (id) => {
                  try {
                    const response = await fetch(`/api/containers/${id}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Failed to delete container');
                    fetchContainers();
                    toast({
                      title: 'Succès',
                      description: 'Le conteneur a été supprimé',
                    });
                  } catch (error) {
                    toast({
                      title: 'Erreur',
                      description: 'Impossible de supprimer le conteneur',
                      variant: 'destructive',
                    });
                  }
                }}
                onLogs={async (id) => {
                  const container = containers.find(c => c.dockerId === id);
                  if (!container) return;
                  
                  setSelectedContainer(container);
                  setShowLogs(true);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              <ImageManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Terminal Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden animate-pulse">
                      <CardHeader className="h-[60px] bg-muted" />
                      <CardContent className="h-[100px] bg-muted" />
                    </Card>
                  ))
                ) : containers.length === 0 ? (
                  <div className="col-span-3 text-center py-12">
                    <p className="text-muted-foreground">No containers found</p>
                  </div>
                ) : (
                  containers.map((container) => (
                    <Card key={container.Id} className="overflow-hidden">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          {container.Names[0].replace(/^\//, '')}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge className={
                            container.State === 'running' 
                              ? 'bg-green-500/20 text-green-500'
                              : container.State === 'stopped' || container.State === 'exited'
                              ? 'bg-red-500/20 text-red-500'
                              : 'bg-gray-500/20 text-gray-500'
                          }>
                            {container.State}
                          </Badge>
                          {container.State === 'running' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                // Ouvrir le terminal dans une nouvelle fenêtre
                                const width = 800;
                                const height = 600;
                                const left = window.screenX + (window.outerWidth - width) / 2;
                                const top = window.screenY + (window.outerHeight - height) / 2;
                                
                                window.open(
                                  `/terminal?containerId=${container.Id}&name=${encodeURIComponent(container.Names[0].replace(/^\//, ''))}`,
                                  `terminal_${container.Id}`,
                                  `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
                                );
                              }}
                            >
                              <TerminalIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">
                            ID: <span className="font-mono">{container.Id.slice(0, 12)}</span>
                          </div>
                          {container.State === 'running' && activeTerminals.includes(container.Id) && (
                            <div className="relative mt-4">
                              <div className="h-[300px] rounded-md overflow-hidden">
                                <WebTerminal containerId={container.Id} />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2"
                                onClick={() => setMaximizedTerminal(container.Id)}
                              >
                                <Maximize2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <UserManager onUserSelect={setSelectedUserId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Center</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertCenter />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volumes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Volume Management</CardTitle>
            </CardHeader>
            <CardContent>
              <VolumeManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showLogs && selectedContainer && (
        <Dialog open={showLogs} onOpenChange={setShowLogs}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <ContainerLogs
              containerId={selectedContainer.dockerId}
              containerName={selectedContainer.Name}
              onClose={() => setShowLogs(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
