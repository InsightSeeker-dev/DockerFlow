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
      <Tabs defaultValue={activeTab} className="space-y-4" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="containers" className="flex items-center gap-2">
            <Container className="h-4 w-4" />
            Containers
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Images
          </TabsTrigger>
          <TabsTrigger value="networks" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Networks
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* System Resources Section */}
          <div>
            <h3 className="text-lg font-medium mb-4">System Resources</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStats?.cpuUsage ? `${systemStats.cpuUsage.toFixed(1)}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {systemStats?.cpuCount ? `${systemStats.cpuCount} cores` : ''}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                  <CircuitBoard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStats?.memoryUsage ? `${systemStats.memoryUsage.percentage.toFixed(1)}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {systemStats?.memoryUsage ? `${Math.round(systemStats.memoryUsage.used / 1024 / 1024)} MB used` : ''}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStats?.diskUsage ? `${systemStats.diskUsage.percentage.toFixed(1)}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {systemStats?.diskUsage ? `${Math.round(systemStats.diskUsage.used / 1024 / 1024)} MB used` : ''}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
                  <Signal className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStats?.networkIO ? `${(systemStats.networkIO / 1024 / 1024).toFixed(1)} MB/s` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Network traffic</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Images Section */}
          <div>
            <h3 className="text-lg font-medium mb-4">Images</h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Images</CardTitle>
                  <Image className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStats?.images?.total || 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Docker images</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStats?.images?.size ? `${(systemStats.images.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Total size of images</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* User Management Section */}
          <div>
            <h3 className="text-lg font-medium mb-4">User Management</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats?.totalUsers ?? 'N/A'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats?.activeUsers ?? 'N/A'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Users</CardTitle>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats?.newUsers ?? 'N/A'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Suspended Users</CardTitle>
                  <UserX className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats?.suspendedUsers ?? 'N/A'}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Container Management Section */}
          <div>
            <h3 className="text-lg font-medium mb-4">Container Management</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
                  <Container className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats?.containers ?? 'N/A'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Running</CardTitle>
                  <Play className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats?.containersRunning ?? 'N/A'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stopped</CardTitle>
                  <Square className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats?.containersStopped ?? 'N/A'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Error</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats?.containersError ?? 'N/A'}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Activities Section */}
          <div>
            <h3 className="text-lg font-medium mb-4">Recent Activities</h3>
            <Card>
              <ScrollArea className="h-[400px]">
                <CardContent className="p-4">
                  {recentActivities.length > 0 ? (
                    recentActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between py-4 border-b last:border-0"
                      >
                        <div className="flex items-center space-x-4">
                          {activity.type === 'user' && <Users className="h-4 w-4" />}
                          {activity.type === 'container' && <Container className="h-4 w-4" />}
                          {activity.type === 'system' && <Activity className="h-4 w-4" />}
                          <div>
                            <p className="text-sm font-medium">{activity.action}</p>
                            <p className="text-xs text-muted-foreground">{activity.description}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      No recent activities
                    </div>
                  )}
                </CardContent>
              </ScrollArea>
            </Card>
          </div>
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
