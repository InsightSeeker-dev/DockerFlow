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
import { OverviewRecentActivities } from './overview-recent-activities';

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
    <div className={cn("p-2 rounded-full", `bg-${color}-500/10`)} >
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
        <motion.div variants={item} className="lg:col-span-1">
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
        <motion.div variants={item} className="lg:col-span-1">
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
        <motion.div variants={item} className="lg:col-span-1">
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
                  color="blue"
                />
                <StatCard
                  icon={ArrowDown}
                  title="Pull Count"
                  value={systemStats.images.pulls}
                  color="green"
                />
                <StatCard
                  icon={Image}
                  title="Avg. Size"
                  value={`${(systemStats.images.size / (systemStats.images.total || 1) / (1024 * 1024)).toFixed(1)} MB`}
                  color="indigo"
                />
              </div>

              {/* Popular Tags */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium mb-2">Popular Tags</h3>
                <div className="grid gap-2">
                  {(systemStats.images.tags || []).map((tag, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium">{tag.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">
                          {tag.count} {tag.count === 1 ? 'image' : 'images'}
                        </span>
                        <div className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium">
                          #{index + 1}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!systemStats.images.tags || systemStats.images.tags.length === 0) && (
                    <div className="flex flex-col items-center justify-center p-4 text-muted-foreground bg-secondary/20 rounded-lg">
                      <Image className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No Docker tags available</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activities */}
        <motion.div variants={item}>
          <OverviewRecentActivities />
        </motion.div>
      </div>
    </motion.div>
  );
}
