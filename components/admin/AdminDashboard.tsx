'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ContainerManager from './ContainerManager';
import ImageManager from './ImageManager';
import NetworkManager from './NetworkManager';
import AlertCenter from './AlertCenter';
import UserManager from './UserManager';
import { Container, Image, Network, Bell, Settings, Users, Activity, LayoutDashboard } from 'lucide-react';
import AdminSettings from './AdminSettings';
import { SystemStats } from '@/types/system';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        const response = await fetch('/api/admin/system/stats');
        if (response.ok) {
          const data = await response.json();
          setSystemStats(data);
        }
      } catch (error) {
        console.error('Error fetching system stats:', error);
      }
    };

    fetchSystemStats();
    const interval = setInterval(fetchSystemStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
  };

  const renderDashboard = () => {
    if (!systemStats) return <div>Chargement...</div>;

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conteneurs</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.containers}</div>
            <p className="text-xs text-muted-foreground">
              {systemStats.containersRunning} actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.cpuUsage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {systemStats.cpuCount} cœurs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mémoire</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStats.memoryUsage.percentage.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(systemStats.memoryUsage.used / 1024 / 1024)} MB utilisés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stockage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStats.diskUsage.percentage.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(systemStats.diskUsage.used / 1024 / 1024)} MB utilisés
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-bold">Tableau de bord administrateur</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-7 gap-4 bg-transparent h-auto p-0">
          <TabsTrigger
            value="dashboard"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-4"
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-4"
          >
            <Users className="h-5 w-5" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger
            value="containers"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-4"
          >
            <Container className="h-5 w-5" />
            Conteneurs
          </TabsTrigger>
          <TabsTrigger
            value="images"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-4"
          >
            <Image className="h-5 w-5" />
            Images
          </TabsTrigger>
          <TabsTrigger
            value="networks"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-4"
          >
            <Network className="h-5 w-5" />
            Réseaux
          </TabsTrigger>
          <TabsTrigger
            value="alerts"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-4"
          >
            <Bell className="h-5 w-5" />
            Alertes
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 py-4"
          >
            <Settings className="h-5 w-5" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6 space-y-6">
          {renderDashboard()}
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UserManager onUserSelect={handleUserSelect} />
        </TabsContent>

        <TabsContent value="containers" className="mt-6">
          <ContainerManager />
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          <ImageManager />
        </TabsContent>

        <TabsContent value="networks" className="mt-6">
          <NetworkManager />
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <AlertCenter />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <AdminSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
