'use client';

import { useState, useEffect } from 'react';
import { Container, ContainerStats, Port } from '@/lib/docker/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  Play as PlayIcon,
  Square as StopIcon,
  Trash as TrashIcon,
  ExternalLink as ExternalLinkIcon,
  RefreshCw as RefreshIcon,
  Terminal as TerminalIcon,
  HardDrive as VolumeIcon,
  Network as NetworkIcon,
  Clock as ClockIcon,
  Activity as StatsIcon,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ContainerCardProps {
  container: Container;
  onStatusChange: () => void;
}

export function ContainerCard({ container, onStatusChange }: ContainerCardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [statsInterval, setStatsInterval] = useState<NodeJS.Timeout | null>(null);

  // Format container name and remove leading slash
  const containerName = container.Names[0].replace(/^\//, '');

  // Format creation date using the Created timestamp
  const createdDate = new Date(container.Created * 1000).toLocaleString();

  // Format ports for display
  const formattedPorts: Port[] = Object.entries(container.NetworkSettings.Ports || {})
    .flatMap(([key, bindings]) => {
      if (!bindings) return [];
      const [privatePort, protocol] = key.split('/');
      return bindings.map(binding => ({
        PrivatePort: parseInt(privatePort),
        PublicPort: parseInt(binding.HostPort),
        Type: protocol,
      }));
    });

  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      if (!showStats) return;
      
      try {
        const response = await fetch(`/api/containers/${container.Id}/stats`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (mounted) {
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch container stats:', error);
        toast({
          title: "Error",
          description: "Failed to fetch container statistics",
          variant: "destructive",
        });
        if (mounted) {
          setShowStats(false);
        }
      }
    };

    if (showStats) {
      fetchStats();
      const interval = setInterval(fetchStats, 2000);
      setStatsInterval(interval);
    }

    return () => {
      mounted = false;
      if (statsInterval) {
        clearInterval(statsInterval);
        setStatsInterval(null);
      }
    };
  }, [showStats, container.Id, toast]);

  // Handle container actions
  const handleAction = async (action: 'start' | 'stop' | 'remove') => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/containers/${container.Id}/${action}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${action} container`);
      }

      toast({
        title: 'Success',
        description: `Container ${action}ed successfully`,
      });

      onStatusChange();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={cn('overflow-hidden transition-all duration-200', {
      'border-green-500/50': container.State.toLowerCase() === 'running',
      'border-red-500/50': container.State.toLowerCase() === 'exited',
      'opacity-75': isLoading,
    })}>
      <CardHeader className="space-y-0 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="truncate text-base">
            <Tooltip>
              <TooltipTrigger>{containerName}</TooltipTrigger>
              <TooltipContent>
                <p>ID: {container.Id.slice(0, 12)}</p>
                <p>Image: {container.Image}</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <ContainerStatus state={container.State} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Basic Information */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center text-muted-foreground">
            <ClockIcon className="mr-2 h-4 w-4" />
            Created: {createdDate}
          </div>
          {formattedPorts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {formattedPorts.map((port, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs"
                >
                  {port.PublicPort}:{port.PrivatePort}/{port.Type}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Container Stats */}
        {showStats && stats && (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>CPU Usage</span>
                <span>{stats.cpu.toFixed(1)}%</span>
              </div>
              <Progress value={stats.cpu} className="h-1" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>Memory Usage</span>
                <span>
                  {formatBytes(stats.memory.usage)} / {formatBytes(stats.memory.limit)} ({stats.memory.percentage.toFixed(1)}%)
                </span>
              </div>
              <Progress value={stats.memory.percentage} className="h-1" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>Network I/O</span>
                <span>
                  ↓ {formatBytes(stats.network.rx_bytes)}/s ↑ {formatBytes(stats.network.tx_bytes)}/s
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {container.State.toLowerCase() === 'running' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('stop')}
              disabled={isLoading}
            >
              <StopIcon className="mr-1 h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('start')}
              disabled={isLoading}
            >
              <PlayIcon className="mr-1 h-4 w-4" />
              Start
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                <TrashIcon className="mr-1 h-4 w-4" />
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Container</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove this container? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleAction('remove')}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStats(!showStats)}
            disabled={container.State.toLowerCase() !== 'running'}
          >
            <StatsIcon className="mr-1 h-4 w-4" />
            Stats
          </Button>

          {container.State.toLowerCase() === 'running' && (
            <a
              href={`/containers/${container.Id}/logs`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <TerminalIcon className="mr-1 h-4 w-4" />
                Logs
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ContainerStatus({ state }: { state: string }) {
  const variants = {
    running: 'bg-green-500/10 text-green-500 border-green-500/20',
    exited: 'bg-red-500/10 text-red-500 border-red-500/20',
    created: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    default: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  };

  const normalizedState = state.toLowerCase();

  return (
    <Badge
      variant="outline"
      className={cn(
        'capitalize',
        variants[normalizedState as keyof typeof variants] || variants.default
      )}
    >
      {state}
    </Badge>
  );
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}