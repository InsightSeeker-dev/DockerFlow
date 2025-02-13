'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ContainerList } from '../containers/container-list';
import { Container } from '@/lib/docker/types';
import ImageManager from './ImageManager';
import NetworkManager from './NetworkManager';
import AlertCenter from './AlertCenter';
import AdminSettings from './AdminSettings';
import { UserManager } from './UserManager';
import { DashboardOverview } from './DashboardOverview';
import { getSystemStats } from '@/lib/api';
import { SystemStats } from '@/types/system';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Container as ContainerIcon,
  Image as ImageIcon,
  Network as NetworkIcon,
  Bell,
  Settings,
  Users,
  LayoutDashboard,
  LogOut
} from 'lucide-react';
import { signOut } from 'next-auth/react';

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
  const { toast } = useToast();
  
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

  const fetchContainers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/containers');
      if (!response.ok) {
        throw new Error('Failed to fetch containers');
      }
      const data = await response.json();
      setContainers(data);
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
          <TabsTrigger value="images" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            <span>Images</span>
          </TabsTrigger>
          <TabsTrigger value="networks" className="flex items-center gap-2">
            <NetworkIcon className="h-4 w-4" />
            <span>Networks</span>
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

        <TabsContent value="networks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Management</CardTitle>
            </CardHeader>
            <CardContent>
              <NetworkManager />
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
    </div>
  );
}
