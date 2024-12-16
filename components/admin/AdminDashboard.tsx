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
  Plus
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

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('overview');
  const [containers, setContainers] = useState([]);
  const [systemStats, setSystemStats] = useState({
    cpu: { usage: 65, trend: '+5%' },
    memory: { usage: 72, trend: '+3%' },
    disk: { usage: 45, trend: '-2%' },
    network: { usage: 215, trend: '+4%' }
  });
  const [userStats, setUserStats] = useState({
    total: 342,
    active: 278,
    new: 24,
    suspended: 14
  });
  const [containerStats, setContainerStats] = useState({
    total: 128,
    running: 87,
    stopped: 31,
    error: 10
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch containers and stats...
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderSystemMetric = (icon: React.ReactNode, title: string, value: number, trend: string, color: string = 'blue') => (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {icon}
            <h3 className="text-sm font-medium text-gray-200">{title}</h3>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${trend.startsWith('+') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {trend}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{value}%</span>
          </div>
          <Progress value={value} className="h-2" />
        </div>
      </CardContent>
    </Card>
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
          <div className="space-y-6">
            {activeTab === 'overview' && (
              <>
                {/* System Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {renderSystemMetric(
                    <Database className="h-5 w-5 text-blue-400" />,
                    "CPU Usage",
                    systemStats.cpu.usage,
                    systemStats.cpu.trend
                  )}
                  {renderSystemMetric(
                    <Server className="h-5 w-5 text-green-400" />,
                    "Memory Usage",
                    systemStats.memory.usage,
                    systemStats.memory.trend,
                    'green'
                  )}
                  {renderSystemMetric(
                    <ContainerIcon className="h-5 w-5 text-purple-400" />,
                    "Disk Usage",
                    systemStats.disk.usage,
                    systemStats.disk.trend,
                    'purple'
                  )}
                  {renderSystemMetric(
                    <Shield className="h-5 w-5 text-yellow-400" />,
                    "Network Traffic",
                    systemStats.network.usage,
                    systemStats.network.trend,
                    'yellow'
                  )}
                </div>

                {/* User Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Users className="mr-2 h-5 w-5 text-blue-400" />
                        Gestion des utilisateurs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-400">Total</p>
                          <p className="text-2xl font-bold">{userStats.total}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-400">Actifs</p>
                          <p className="text-2xl font-bold text-green-400">{userStats.active}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-400">Nouveaux</p>
                          <p className="text-2xl font-bold text-blue-400">{userStats.new}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-400">Suspendus</p>
                          <p className="text-2xl font-bold text-red-400">{userStats.suspended}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Container Stats */}
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <ContainerIcon className="mr-2 h-5 w-5 text-purple-400" />
                        Gestion des conteneurs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-400">Total</p>
                          <p className="text-2xl font-bold">{containerStats.total}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-400">En cours</p>
                          <p className="text-2xl font-bold text-green-400">{containerStats.running}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-400">Arrêtés</p>
                          <p className="text-2xl font-bold text-yellow-400">{containerStats.stopped}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-400">Erreurs</p>
                          <p className="text-2xl font-bold text-red-400">{containerStats.error}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activities */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle>Activités récentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Add recent activities list here */}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === 'users' && (
              <div>
                <UserManager />
              </div>
            )}

            {activeTab === 'containers' && (
              <div>
                <DockerImageManager />
              </div>
            )}

            {activeTab === 'monitoring' && (
              <div>
                <ResourceMonitoring />
              </div>
            )}

            {activeTab === 'alerts' && (
              <div>
                <AlertCenter />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
