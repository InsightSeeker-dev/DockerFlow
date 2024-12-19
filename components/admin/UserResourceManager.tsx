import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResourceUsage } from '@/hooks/use-resources';
import { Cpu, CircleOff, HardDrive } from 'lucide-react';

interface UserResourceManagerProps {
  userId: string;
  resources: ResourceUsage | null;
  onUpdate: (updates: Partial<ResourceUsage>) => Promise<void>;
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
    await onUpdate({ [resource]: value });
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
                <span>{formatCPU(resources?.cpuLimit || 0)}</span>
              </div>
              <Slider
                value={[resources?.cpuLimit || 0]}
                max={4000} // 4 cores
                step={100}
                onValueChange={([value]) => handleSliderChange('cpuLimit', value)}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Usage: {formatCPU(resources?.cpuUsage || 0)}</span>
              <span>{((resources?.cpuUsage || 0) / (resources?.cpuLimit || 1) * 100).toFixed(1)}%</span>
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
                <span>{formatBytes(resources?.memoryLimit || 0)}</span>
              </div>
              <Slider
                value={[resources?.memoryLimit || 0]}
                max={8589934592} // 8GB
                step={268435456} // 256MB
                onValueChange={([value]) => handleSliderChange('memoryLimit', value)}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Usage: {formatBytes(resources?.memoryUsage || 0)}</span>
              <span>{((resources?.memoryUsage || 0) / (resources?.memoryLimit || 1) * 100).toFixed(1)}%</span>
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
                <span>{formatBytes(resources?.storageLimit || 0)}</span>
              </div>
              <Slider
                value={[resources?.storageLimit || 0]}
                max={107374182400} // 100GB
                step={1073741824} // 1GB
                onValueChange={([value]) => handleSliderChange('storageLimit', value)}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Usage: {formatBytes(resources?.storageUsage || 0)}</span>
              <span>{((resources?.storageUsage || 0) / (resources?.storageLimit || 1) * 100).toFixed(1)}%</span>
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
