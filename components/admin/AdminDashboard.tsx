'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Container, 
  Bell, 
  ChevronDown, 
  LayoutDashboard,
  Activity,
  Settings
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserManager from '@/components/admin/UserManager';
import UserResourceManager from '@/components/admin/UserResourceManager';
import ResourceMonitoring from '@/components/admin/ResourceMonitoring';
import AlertCenter from '@/components/admin/AlertCenter';
import { SystemStats } from '@/types/system';
import { UserResource } from '@/types/admin';
import { useResources, ResourceUsage } from '@/hooks/use-resources';
import { useRouter } from 'next/navigation';

type Tab = 'overview' | 'users' | 'containers' | 'monitoring' | 'alerts';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Utiliser le hook useResources pour gérer les ressources utilisateur
  const { 
    resources: userResources, 
    isLoading: isLoadingResources,
    error: resourcesError,
    updateResources 
  } = useResources({ 
    userId: selectedUserId,
    refreshInterval: 5000 // Rafraîchir toutes les 5 secondes
  });

  // Fonction pour gérer la sélection d'un utilisateur
  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
  };

  // Fonction pour mettre à jour les ressources d'un utilisateur
  const handleResourceUpdate = async (updates: Partial<UserResource>) => {
    try {
      await updateResources(updates);
    } catch (error) {
      console.error('Error updating user resources:', error);
    }
  };

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        const response = await fetch('/api/system/stats');
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

  const renderOverviewTab = () => {
    if (!systemStats) return <div>Loading...</div>;

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-400">Conteneurs</div>
                <div className="text-2xl font-bold">{systemStats.containers}</div>
              </div>
              <Container className="h-8 w-8 text-gray-400" />
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-400">
                {systemStats.containersRunning} actifs
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-400">CPU</div>
                <div className="text-2xl font-bold">
                  {systemStats.cpuUsage.toFixed(1)}%
                </div>
              </div>
              <Activity className="h-8 w-8 text-gray-400" />
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-400">
                {systemStats.cpuCount} cores
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-400">Mémoire</div>
                <div className="text-2xl font-bold">
                  {systemStats.memoryUsage.percentage.toFixed(1)}%
                </div>
              </div>
              <Activity className="h-8 w-8 text-gray-400" />
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-400">
                {Math.round(systemStats.memoryUsage.used / 1024 / 1024)} MB utilisés
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-400">Stockage</div>
                <div className="text-2xl font-bold">
                  {systemStats.diskUsage.percentage.toFixed(1)}%
                </div>
              </div>
              <Activity className="h-8 w-8 text-gray-400" />
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-400">
                {Math.round(systemStats.diskUsage.used / 1024 / 1024)} MB utilisés
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Administration</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => router.push('/admin/settings')} className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Paramètres
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Actions <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                Rafraîchir les données
              </DropdownMenuItem>
              <DropdownMenuItem>
                Exporter les statistiques
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
          <div className="flex-1">
            <div className="flex items-center space-x-4">
              <Button
                variant={activeTab === 'overview' ? 'default' : 'ghost'}
                className="flex items-center"
                onClick={() => setActiveTab('overview')}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Vue d'ensemble
              </Button>
              <Button
                variant={activeTab === 'users' ? 'default' : 'ghost'}
                className="flex items-center"
                onClick={() => setActiveTab('users')}
              >
                <Users className="mr-2 h-4 w-4" />
                Utilisateurs
              </Button>
              <Button
                variant={activeTab === 'containers' ? 'default' : 'ghost'}
                className="flex items-center"
                onClick={() => setActiveTab('containers')}
              >
                <Container className="mr-2 h-4 w-4" />
                Conteneurs
              </Button>
              <Button
                variant={activeTab === 'monitoring' ? 'default' : 'ghost'}
                className="flex items-center"
                onClick={() => setActiveTab('monitoring')}
              >
                <Activity className="mr-2 h-4 w-4" />
                Monitoring
              </Button>
              <Button
                variant={activeTab === 'alerts' ? 'default' : 'ghost'}
                className="flex items-center"
                onClick={() => setActiveTab('alerts')}
              >
                <Bell className="mr-2 h-4 w-4" />
                Alertes
              </Button>
            </div>
          </div>

          {/* Add button based on active tab */}
          <div className="flex justify-end">
            {(activeTab === 'users' || activeTab === 'containers' || activeTab === 'alerts') && (
              <div className="flex space-x-2">
                <Button>
                  {activeTab === 'users' ? 'Nouvel utilisateur' :
                   activeTab === 'containers' ? 'Nouveau conteneur' :
                   'Nouvelle alerte'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'overview' ? renderOverviewTab() :
         activeTab === 'users' ? <UserManager onUserSelect={handleUserSelect} /> :
         activeTab === 'containers' ? (
           <UserResourceManager 
             userId={selectedUserId}
             resources={userResources as ResourceUsage | null}
             onUpdate={handleResourceUpdate}
           />
         ) :
         activeTab === 'monitoring' ? <ResourceMonitoring /> :
         <AlertCenter />}
      </div>
    </div>
  );
}
