'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ContainerManager from './ContainerManager';
import ImageManager from './ImageManager';
import NetworkManager from './NetworkManager';
import AlertCenter from './AlertCenter';
import UserManager from './UserManager';
import { useToast } from '@/components/ui/use-toast';
import {
  Container,
  Image,
  Network,
  Bell,
  Settings,
  Users,
  Activity,
  LayoutDashboard,
  UserCheck,
  UserPlus,
  UserX,
  Play,
  Square,
  AlertTriangle,
  Cpu,
  CircuitBoard,
  HardDrive,
  Signal,
} from 'lucide-react';
import AdminSettings from './AdminSettings';
import { SystemStats } from '@/types/system';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { motion } from 'framer-motion';
import { DashboardOverview } from './DashboardOverview';

interface RecentActivity {
  id: string;
  type: 'user' | 'container' | 'system';
  action: string;
  description: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        const response = await fetch('/api/admin/system/stats');
        if (!response.ok) throw new Error('Failed to fetch system stats');
        const data = await response.json();
        setSystemStats(data);
      } catch (err) {
        setError('Failed to load system statistics');
        toast({
          title: 'Error',
          description: 'Failed to load system statistics',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSystemStats();
    const interval = setInterval(fetchSystemStats, 30000);
    return () => clearInterval(interval);
  }, [toast]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <motion.div 
          className="flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
        >
          <Container className="text-blue-500 mr-3" size={40} />
          <div className="flex flex-col items-start">
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
        <TabsList className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-8">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden md:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="containers" className="flex items-center gap-2">
            <Container className="h-4 w-4" />
            <span className="hidden md:inline">Containers</span>
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            <span className="hidden md:inline">Images</span>
          </TabsTrigger>
          <TabsTrigger value="networks" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            <span className="hidden md:inline">Networks</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden md:inline">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden md:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden md:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <DashboardOverview 
            systemStats={systemStats || {
              // Container Stats
              containers: 0,
              containersRunning: 0,
              containersStopped: 0,
              containersError: 0,
              activeContainers: 0,
              containerTrend: 0,
              
              // Image Stats
              images: {
                total: 0,
                size: 0
              },
              
              // User Stats
              totalUsers: 0,
              activeUsers: 0,
              newUsers: 0,
              suspendedUsers: 0,
              userTrend: 0,
              
              // System Resources
              cpuUsage: 0,
              cpuCount: 0,
              cpuTrend: 0,
              networkIO: 0,
              memoryUsage: {
                used: 0,
                total: 0,
                percentage: 0
              },
              memoryTrend: 0,
              diskUsage: {
                used: 0,
                total: 0,
                percentage: 0
              },
              
              // Performance History
              performanceHistory: []
            }}
            recentActivities={recentActivities}
          />
        </TabsContent>

        <TabsContent value="containers">
          <ContainerManager />
        </TabsContent>

        <TabsContent value="images">
          <ImageManager />
        </TabsContent>

        <TabsContent value="networks">
          <NetworkManager />
        </TabsContent>

        <TabsContent value="users">
          <UserManager onUserSelect={setSelectedUserId} />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertCenter />
        </TabsContent>

        <TabsContent value="settings">
          <AdminSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
