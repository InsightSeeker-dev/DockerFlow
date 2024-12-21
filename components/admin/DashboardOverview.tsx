import React from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container, Users, Activity, Cpu, HardDrive, Signal, Image, Play, Square, AlertTriangle, UserCheck, UserPlus, UserX } from 'lucide-react';
import { SystemStats } from '@/types/system';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardOverviewProps {
  systemStats: SystemStats;
  recentActivities: Array<{
    id: string;
    type: string;
    action: string;
    description: string;
    timestamp: string;
  }>;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export function DashboardOverview({ systemStats, recentActivities }: DashboardOverviewProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Métriques principales */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Container Management */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Container className="h-5 w-5 text-blue-500" />
                Container Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-blue-500/10">
                      <Container className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Containers</p>
                      <p className="text-2xl font-bold">{systemStats.containers}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-green-500/10">
                      <Play className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Running</p>
                      <p className="text-2xl font-bold">{systemStats.containersRunning}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-orange-500/10">
                      <Square className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Stopped</p>
                      <p className="text-2xl font-bold">{systemStats.containersStopped}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-red-500/10">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Error</p>
                      <p className="text-2xl font-bold">{systemStats.containersError}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* User Management */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-blue-500/10">
                      <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Users</p>
                      <p className="text-2xl font-bold">{systemStats.totalUsers}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-green-500/10">
                      <UserCheck className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Active Users</p>
                      <p className="text-2xl font-bold">{systemStats.activeUsers}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-purple-500/10">
                      <UserPlus className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">New Users</p>
                      <p className="text-2xl font-bold">{systemStats.newUsers}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-red-500/10">
                      <UserX className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Suspended</p>
                      <p className="text-2xl font-bold">{systemStats.suspendedUsers}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* CPU et Mémoire */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div variants={item}>
          <MetricCard
            title="Utilisation CPU"
            value={systemStats.cpuUsage}
            trend={systemStats.cpuTrend}
            icon={<Cpu />}
            color="purple"
            description={`${systemStats.cpuCount} cœurs`}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            title="Utilisation Mémoire"
            value={systemStats.memoryUsage.percentage}
            trend={systemStats.memoryTrend}
            icon={<HardDrive />}
            color="orange"
            description={`${Math.round(systemStats.memoryUsage.used / 1024 / 1024)} MB utilisés`}
          />
        </motion.div>
      </div>

      {/* Graphiques et Activités Récentes */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                Performance Système
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={systemStats.performanceHistory}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="cpu"
                      stroke="#8b5cf6"
                      name="CPU"
                    />
                    <Line
                      type="monotone"
                      dataKey="memory"
                      stroke="#3b82f6"
                      name="Mémoire"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Signal className="h-5 w-5 text-green-500" />
                Activités Récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className={cn(
                      "p-2 rounded-full",
                      activity.type === 'user' && "bg-blue-500/10",
                      activity.type === 'container' && "bg-green-500/10",
                      activity.type === 'system' && "bg-orange-500/10"
                    )}>
                      {activity.type === 'user' && <Users className="h-4 w-4 text-blue-500" />}
                      {activity.type === 'container' && <Container className="h-4 w-4 text-green-500" />}
                      {activity.type === 'system' && <Activity className="h-4 w-4 text-orange-500" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </time>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Section Images */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-purple-500" />
              Images Docker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-purple-500/10">
                    <Image className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Images Totales</p>
                    <p className="text-2xl font-bold">{systemStats.images.total}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-blue-500/10">
                    <HardDrive className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Espace Utilisé</p>
                    <p className="text-2xl font-bold">
                      {(systemStats.images.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <Activity className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Taille Moyenne</p>
                    <p className="text-2xl font-bold">
                      {systemStats.images.total > 0
                        ? ((systemStats.images.size / systemStats.images.total) / (1024 * 1024)).toFixed(0)
                        : 0} MB
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
