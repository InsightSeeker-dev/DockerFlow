import { prisma } from '@/lib/prisma';
import Docker from 'dockerode';
import { EventEmitter } from 'events';

const docker = new Docker();
const monitoringEmitter = new EventEmitter();

export interface ContainerStats {
  cpu_stats: {
    cpu_usage: {
      total_usage: number;
    };
    system_cpu_usage: number;
  };
  memory_stats: {
    usage: number;
    limit: number;
  };
  blkio_stats?: {
    io_service_bytes_recursive?: Array<{
      major: number;
      minor: number;
      op: string;
      value: number;
    }>;
  };
  precpu_stats: {
    cpu_usage: {
      total_usage: number;
    };
    system_cpu_usage: number;
  };
  networks?: {
    [key: string]: {
      rx_bytes: number;
      tx_bytes: number;
    };
  };
}

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  diskUsage: number;
  diskTotal: number;
}

export interface MonitoringError extends Error {
  containerId?: string;
}

export async function getContainerStats(containerId: string) {
  try {
    const container = docker.getContainer(containerId);
    const stats = await container.stats({ stream: false }) as ContainerStats;
    const inspection = await container.inspect();

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuUsage = (cpuDelta / systemDelta) * 100;

    const memoryUsage = stats.memory_stats.usage;
    const memoryLimit = stats.memory_stats.limit;
    const memoryPercent = (memoryUsage / memoryLimit) * 100;

    // Calculate block I/O
    const blkioStats = stats.blkio_stats?.io_service_bytes_recursive || [];
    const readOps = blkioStats.find(stat => stat.op.toLowerCase() === 'read')?.value || 0;
    const writeOps = blkioStats.find(stat => stat.op.toLowerCase() === 'write')?.value || 0;

    const userId = inspection.Config.Labels['com.dockerflow.userId'];
    if (!userId) {
      throw new Error('Container does not have a user ID label');
    }

    const resourceUsage = await saveResourceUsage(userId, containerId, {
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage,
      memoryLimit,
      diskRead: readOps,
      diskWrite: writeOps,
    });

    monitoringEmitter.emit('stats', {
      containerId,
      stats: resourceUsage,
    });

    return resourceUsage;
  } catch (error) {
    const monitoringError = error as MonitoringError;
    console.error(`Error getting container stats for ${containerId}:`, monitoringError);
    throw monitoringError;
  }
}

export async function saveResourceUsage(userId: string, containerId: string | null, stats: any) {
  await prisma.resourceUsage.create({
    data: {
      userId,
      containerId,
      cpuUsage: stats.cpuUsage,
      memoryUsage: stats.memoryUsage,
      networkIO: stats.networkIO || 0,
    },
  });
}

export async function startMonitoring(containerId: string, interval = 10000) {
  const monitor = async () => {
    try {
      await getContainerStats(containerId);
    } catch (error) {
      const monitoringError = error as MonitoringError;
      console.error(`Failed to get stats for container ${containerId}:`, monitoringError);
      monitoringEmitter.emit('error', {
        containerId,
        error: monitoringError.message,
      });
    }
  };

  const timerId = setInterval(monitor, interval);
  monitoringEmitter.emit('monitoring-started', { containerId });

  return () => {
    clearInterval(timerId);
    monitoringEmitter.emit('monitoring-stopped', { containerId });
  };
}

export function subscribeToStats(callback: (data: any) => void) {
  monitoringEmitter.on('stats', callback);
  return () => monitoringEmitter.off('stats', callback);
}

export function subscribeToErrors(callback: (data: any) => void) {
  monitoringEmitter.on('error', callback);
  return () => monitoringEmitter.off('error', callback);
}

export const resourceMonitor = {
  getContainerStats,
  startMonitoring,
  subscribeToStats,
  subscribeToErrors,
  saveResourceUsage
};
