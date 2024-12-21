import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Container, 
  Users, 
  Activity, 
  Cpu, 
  HardDrive, 
  Signal, 
  Image, 
  Play, 
  Square, 
  AlertTriangle, 
  UserCheck, 
  UserPlus, 
  UserX,
  Network,
  ArrowDown,
  ArrowUp,
  Percent,
  Server,
  Settings
} from 'lucide-react';
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
  AreaChart,
  Area
} from 'recharts';

interface DashboardOverviewProps {
  systemStats: SystemStats;
  recentActivities: any[];
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
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

const StatCard = ({ icon: Icon, title, value, trend, color, className }: any) => (
  <div className={cn(
    "flex items-center gap-3 p-3 rounded-lg bg-card border shadow-sm",
    className
  )}>
    <div className={cn("p-2 rounded-full", `bg-${color}-500/10`)}>
      <Icon className={cn("h-4 w-4", `text-${color}-500`)} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm text-muted-foreground truncate">{title}</p>
      <div className="flex items-center gap-2">
        <p className="text-lg font-semibold truncate">{value}</p>
        {trend !== undefined && (
          <span className={cn(
            "text-xs",
            trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"
          )}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "−"} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  </div>
);

export function DashboardOverview({ systemStats, recentActivities }: DashboardOverviewProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Section Principale - Vue d'ensemble */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Container Overview */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Container className="h-5 w-5 text-blue-500" />
                <span>Containers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  icon={Container}
                  title="Total"
                  value={systemStats.containers}
                  trend={systemStats.containerTrend}
                  color="blue"
                />
                <StatCard
                  icon={Play}
                  title="Running"
                  value={systemStats.containersRunning}
                  color="green"
                />
                <StatCard
                  icon={Square}
                  title="Stopped"
                  value={systemStats.containersStopped}
                  color="orange"
                />
                <StatCard
                  icon={AlertTriangle}
                  title="Errors"
                  value={systemStats.containersError}
                  color="red"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* User Overview */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                <span>Users</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  icon={Users}
                  title="Total"
                  value={systemStats.totalUsers}
                  trend={systemStats.userTrend}
                  color="green"
                />
                <StatCard
                  icon={UserCheck}
                  title="Active"
                  value={systemStats.activeUsers}
                  color="green"
                />
                <StatCard
                  icon={UserPlus}
                  title="New"
                  value={systemStats.newUsers}
                  color="purple"
                />
                <StatCard
                  icon={UserX}
                  title="Suspended"
                  value={systemStats.suspendedUsers}
                  color="red"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* System Overview */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-5 w-5 text-purple-500" />
                <span>System</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  icon={Cpu}
                  title="CPU Usage"
                  value={`${systemStats.cpuUsage}%`}
                  trend={systemStats.cpuTrend}
                  color="purple"
                />
                <StatCard
                  icon={HardDrive}
                  title="Memory"
                  value={`${systemStats.memoryUsage.percentage}%`}
                  trend={systemStats.memoryTrend}
                  color="blue"
                />
                <StatCard
                  icon={HardDrive}
                  title="Storage"
                  value={`${systemStats.diskUsage.percentage}%`}
                  color="indigo"
                />
                <StatCard
                  icon={Network}
                  title="Network"
                  value={`${(systemStats.networkTraffic.in / (1024 * 1024)).toFixed(1)} MB/s`}
                  color="cyan"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Section Images et Activités Récentes */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Docker Images */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Image className="h-5 w-5 text-purple-500" />
                <span>Docker Images</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image Stats */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  icon={Image}
                  title="Total Images"
                  value={systemStats.images.total}
                  color="purple"
                />
                <StatCard
                  icon={HardDrive}
                  title="Total Size"
                  value={`${(systemStats.images.size / (1024 * 1024 * 1024)).toFixed(1)} GB`}
                  color="indigo"
                />
                <StatCard
                  icon={ArrowDown}
                  title="Pull Count"
                  value={systemStats.images.pulls || 0}
                  color="cyan"
                />
                <StatCard
                  icon={HardDrive}
                  title="Avg. Size"
                  value={`${((systemStats.images.size / systemStats.images.total) / (1024 * 1024)).toFixed(1)} MB`}
                  color="blue"
                />
              </div>

              {/* Storage Usage Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Storage Usage</span>
                  <span className="font-medium">
                    {(systemStats.images.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-purple-500 transition-all"
                    style={{ width: `${(systemStats.images.size / systemStats.diskUsage.total) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Used: {(systemStats.images.size / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
                  <span>Total: {(systemStats.diskUsage.total / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
                </div>
              </div>

              {/* Tags Distribution */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Popular Tags</h4>
                <div className="space-y-2">
                  {systemStats.images.tags?.slice(0, 3).map((tag, index) => (
                    <div key={index} className="flex items-center justify-between bg-secondary/50 rounded-lg p-2">
                      <span className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        {tag.name}
                      </span>
                      <span className="text-sm text-muted-foreground">{tag.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activities */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <span>Recent Activities</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 pb-4 last:pb-0 border-b last:border-0"
                  >
                    <div className={cn(
                      "p-2 rounded-full shrink-0",
                      activity.type === 'container' && "bg-blue-500/10",
                      activity.type === 'image' && "bg-purple-500/10",
                      activity.type === 'user' && "bg-green-500/10",
                      activity.type === 'system' && "bg-orange-500/10"
                    )}>
                      {activity.type === 'container' && <Container className={cn("h-4 w-4 text-blue-500")} />}
                      {activity.type === 'image' && <Image className={cn("h-4 w-4 text-purple-500")} />}
                      {activity.type === 'user' && <Users className={cn("h-4 w-4 text-green-500")} />}
                      {activity.type === 'system' && <Settings className={cn("h-4 w-4 text-orange-500")} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-none mb-1 truncate">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{activity.user}</span>
                        <span>•</span>
                        <span className="whitespace-nowrap">{activity.time}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {recentActivities.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No recent activities</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
