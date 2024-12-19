import React from 'react';
import { Cpu, CircuitBoard, HardDrive } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserResource } from '@/types/admin';

interface ResourceUsageProps {
  resource: UserResource;
}

const formatBytes = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const formatCPU = (millicores: number): string => {
  return `${(millicores / 1000).toFixed(1)} cores`;
};

const ResourceUsage: React.FC<ResourceUsageProps> = ({ resource }) => {
  const cpuUsage = (resource.cpuUsage || 0) / resource.cpuLimit * 100;
  const memoryUsage = (resource.memoryUsage || 0) / resource.memoryLimit * 100;
  const storageUsage = (resource.storageUsage || 0) / resource.storageLimit * 100;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={cpuUsage} />
            <div className="text-xs text-muted-foreground">
              {formatCPU(resource.cpuUsage || 0)} / {formatCPU(resource.cpuLimit)}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          <CircuitBoard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={memoryUsage} />
            <div className="text-xs text-muted-foreground">
              {formatBytes(resource.memoryUsage || 0)} / {formatBytes(resource.memoryLimit)}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={storageUsage} />
            <div className="text-xs text-muted-foreground">
              {formatBytes(resource.storageUsage || 0)} / {formatBytes(resource.storageLimit)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResourceUsage;
