import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserResource } from '@/types/admin';
import { Cpu, CircleOff, HardDrive } from 'lucide-react';

interface UserResourceManagerProps {
  userId: string;
  resources: UserResource;
  onUpdate: (userId: string, updates: Partial<UserResource>) => Promise<void>;
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

export const UserResourceManager: React.FC<UserResourceManagerProps> = ({
  userId,
  resources,
  onUpdate,
}) => {
  const handleSliderChange = async (
    resource: 'cpuLimit' | 'memoryLimit' | 'storageLimit',
    value: number
  ) => {
    await onUpdate(userId, { [resource]: value });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Cpu className="mr-2" /> CPU Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>CPU Limit</span>
                <span>{formatCPU(resources.cpuLimit)}</span>
              </div>
              <Slider
                value={[resources.cpuLimit]}
                max={4000} // 4 cores
                step={100}
                onValueChange={([value]) => handleSliderChange('cpuLimit', value)}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Usage: {formatCPU(resources.cpuUsage)}</span>
              <span>{((resources.cpuUsage / resources.cpuLimit) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CircleOff className="mr-2" /> Memory Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>Memory Limit</span>
                <span>{formatBytes(resources.memoryLimit)}</span>
              </div>
              <Slider
                value={[resources.memoryLimit]}
                max={8589934592} // 8GB
                step={268435456} // 256MB
                onValueChange={([value]) => handleSliderChange('memoryLimit', value)}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Usage: {formatBytes(resources.memoryUsage)}</span>
              <span>{((resources.memoryUsage / resources.memoryLimit) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <HardDrive className="mr-2" /> Storage Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>Storage Limit</span>
                <span>{formatBytes(resources.storageLimit)}</span>
              </div>
              <Slider
                value={[resources.storageLimit]}
                max={107374182400} // 100GB
                step={1073741824} // 1GB
                onValueChange={([value]) => handleSliderChange('storageLimit', value)}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Usage: {formatBytes(resources.storageUsage)}</span>
              <span>{((resources.storageUsage / resources.storageLimit) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2">
        <Button variant="outline">Reset to Default</Button>
        <Button>Save Changes</Button>
      </div>
    </div>
  );
};

export default UserResourceManager;
