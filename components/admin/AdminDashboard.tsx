'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Server, 
  BarChart2, 
  Shield, 
  Database,
  Settings,
  Container as ContainerIcon,
  LogOut
} from 'lucide-react';
import UserResourceManager from './UserResourceManager';
import DockerImageManager from './DockerImageManager';
import ResourceMonitoring from '../monitoring/ResourceMonitoring';
import AlertCenter from '../alerts/AlertCenter';
import UserManager from './UserManager';
import { useSession, signOut } from "next-auth/react";
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserResource, DockerImageInfo } from '@/types/admin';

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('overview');
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    try {
      const response = await fetch('/api/admin/docker');
      if (!response.ok) throw new Error('Failed to fetch containers');
      const data = await response.json();
      setContainers(data);
    } catch (err) {
      setError('Failed to load containers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleContainerAction = async (containerId: string, action: string) => {
    try {
      const response = await fetch('/api/admin/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId, action }),
      });
      
      if (!response.ok) throw new Error('Failed to perform action');
      await fetchContainers(); // Refresh container list
    } catch (err) {
      setError('Failed to perform container action');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 min-h-screen p-4">
          <div className="flex items-center space-x-2 mb-8">
            <ContainerIcon className="h-8 w-8 text-blue-500" />
            <h1 className="text-xl font-bold">DockerFlow</h1>
          </div>
          
          <nav className="space-y-2">
            <Button
              variant={activeTab === 'overview' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab('overview')}
            >
              <BarChart2 className="mr-2 h-4 w-4" />
              Overview
            </Button>
            
            <Button
              variant={activeTab === 'users' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab('users')}
            >
              <Users className="mr-2 h-4 w-4" />
              Users
            </Button>
            
            <Button
              variant={activeTab === 'containers' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab('containers')}
            >
              <Server className="mr-2 h-4 w-4" />
              Containers
            </Button>
            
            <Button
              variant={activeTab === 'resources' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab('resources')}
            >
              <Database className="mr-2 h-4 w-4" />
              Resources
            </Button>
            
            <Button
              variant={activeTab === 'security' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab('security')}
            >
              <Shield className="mr-2 h-4 w-4" />
              Security
            </Button>
          </nav>

          <div className="absolute bottom-4 w-56">
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">
              Welcome back, {session?.user?.name}
            </h2>
            <p className="text-gray-400">
              Manage your Docker containers and users from this dashboard.
            </p>
          </div>

          {/* Content based on active tab */}
          <div className="space-y-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle>Active Containers</CardTitle>
                    <CardDescription>Total running containers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">
                      {containers.filter((c: any) => c.State === 'running').length}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle>Total Users</CardTitle>
                    <CardDescription>Registered users</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">0</p>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle>System Load</CardTitle>
                    <CardDescription>Current CPU usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">0%</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'containers' && (
              <div className="space-y-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle>Container Management</CardTitle>
                    <CardDescription>Manage your Docker containers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    ) : error ? (
                      <div className="text-red-500">{error}</div>
                    ) : (
                      <div className="space-y-4">
                        {containers.map((container: any) => (
                          <div key={container.Id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                            <div>
                              <p className="font-medium">{container.Names[0]}</p>
                              <p className="text-sm text-gray-400">{container.State}</p>
                            </div>
                            <div className="space-x-2">
                              {container.State === 'running' ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleContainerAction(container.Id, 'stop')}
                                >
                                  Stop
                                </Button>
                              ) : (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleContainerAction(container.Id, 'start')}
                                >
                                  Start
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleContainerAction(container.Id, 'restart')}
                              >
                                Restart
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'users' && <UserManager />}
            {activeTab === 'resources' && <ResourceMonitoring />}
            {activeTab === 'security' && <AlertCenter />}
          </div>
        </div>
      </div>
    </div>
  );
}
