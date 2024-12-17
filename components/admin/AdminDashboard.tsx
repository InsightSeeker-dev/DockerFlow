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
  LogOut,
  Search,
  Filter,
  Plus,
  Cpu,
  HardDrive,
  Activity
} from 'lucide-react';
import UserResourceManager from './UserResourceManager';
import DockerImageManager from './DockerImageManager';
import ResourceMonitoring from '../monitoring/ResourceMonitoring';
import AlertCenter from '../alerts/AlertCenter';
import UserManager from './UserManager';
import { useSession, signOut } from "next-auth/react";
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useMetrics } from "@/hooks/useMetrics";
import { useAdminStats } from "@/hooks/useAdminStats";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('overview');
  const { metrics, loading: metricsLoading, error: metricsError } = useMetrics();
  const { 
    userStats, 
    containerStats, 
    loading: statsLoading, 
    error: statsError 
  } = useAdminStats();

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          // Skeletons pendant le chargement
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[125px] w-full" />
            </div>
          ))
        ) : (
          <>
            <MetricCard
              title="CPU Usage"
              value={metrics?.cpu.usage || 0}
              trend={metrics?.cpu.trend || 0}
              icon={<Cpu className="h-4 w-4" />}
            />
            <MetricCard
              title="Memory Usage"
              value={metrics?.memory.usage || 0}
              trend={metrics?.memory.trend || 0}
              icon={<Database className="h-4 w-4" />}
            />
            <MetricCard
              title="Disk Usage"
              value={metrics?.disk.usage || 0}
              trend={metrics?.disk.trend || 0}
              icon={<HardDrive className="h-4 w-4" />}
            />
            <MetricCard
              title="Network Traffic"
              value={metrics?.network.usage || 0}
              trend={metrics?.network.trend || 0}
              icon={<Activity className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* User Stats */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle>Gestion des utilisateurs</CardTitle>
          <CardDescription>Vue d'ensemble des utilisateurs</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-400">Total</p>
                <p className="text-2xl font-bold">{userStats?.total || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Actifs</p>
                <p className="text-2xl font-bold text-green-500">
                  {userStats?.active || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Nouveaux</p>
                <p className="text-2xl font-bold text-blue-500">
                  {userStats?.new || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Suspendus</p>
                <p className="text-2xl font-bold text-red-500">
                  {userStats?.suspended || 0}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Container Stats */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle>Gestion des conteneurs</CardTitle>
          <CardDescription>Vue d'ensemble des conteneurs</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-400">Total</p>
                <p className="text-2xl font-bold">
                  {containerStats?.total || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">En cours</p>
                <p className="text-2xl font-bold text-green-500">
                  {containerStats?.running || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Arrêtés</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {containerStats?.stopped || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Erreurs</p>
                <p className="text-2xl font-bold text-red-500">
                  {containerStats?.error || 0}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 min-h-screen p-4 fixed">
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
              Tableau de bord
            </Button>
            
            <Button
              variant={activeTab === 'users' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab('users')}
            >
              <Users className="mr-2 h-4 w-4" />
              Utilisateurs
            </Button>
            
            <Button
              variant={activeTab === 'containers' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab('containers')}
            >
              <Server className="mr-2 h-4 w-4" />
              Conteneurs
            </Button>
            
            <Button
              variant={activeTab === 'monitoring' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab('monitoring')}
            >
              <Database className="mr-2 h-4 w-4" />
              Ressources
            </Button>
            
            <Button
              variant={activeTab === 'alerts' ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab('alerts')}
            >
              <Shield className="mr-2 h-4 w-4" />
              Alertes
            </Button>
          </nav>

          <div className="absolute bottom-4 w-56">
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="ml-64 flex-1 p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold">
                {activeTab === 'overview' ? 'Tableau de bord' :
                 activeTab === 'users' ? 'Gestion des utilisateurs' :
                 activeTab === 'containers' ? 'Gestion des conteneurs' :
                 activeTab === 'monitoring' ? 'Surveillance des ressources' :
                 'Centre d\'alertes'}
              </h2>
              <p className="text-gray-400">
                {session?.user?.name} | {session?.user?.role}
              </p>
            </div>
            {activeTab !== 'overview' && (
              <div className="flex space-x-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Rechercher..."
                    className="pl-8 bg-gray-800 border-gray-700"
                  />
                </div>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filtres
                </Button>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {activeTab === 'users' ? 'Nouvel utilisateur' :
                   activeTab === 'containers' ? 'Nouveau conteneur' :
                   'Nouvelle alerte'}
                </Button>
              </div>
            )}
          </div>

          {/* Content based on active tab */}
          {activeTab === 'overview' ? renderOverviewTab() :
           activeTab === 'users' ? <UserManager /> :
           activeTab === 'containers' ? <UserResourceManager /> :
           activeTab === 'monitoring' ? <ResourceMonitoring /> :
           <AlertCenter />}
        </div>
      </div>
    </div>
  );
}
