import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDockerClient } from '@/lib/docker/client';
import { prisma } from '@/lib/prisma';
import os from 'os';
import { Container as DockerContainer, ContainerInspectInfo } from 'dockerode';
import { SystemStats } from '@/types/system';
import { Prisma, User } from '@prisma/client';
import { Session } from 'next-auth';
import { getUserStorageUsage } from '@/lib/docker/storage';

export const dynamic = 'force-dynamic';

// Types
interface ContainerStats {
  memory_stats: {
    usage: number;
    limit?: number;
  };
  cpu_stats: {
    cpu_usage: {
      total_usage: number;
    };
    system_cpu_usage: number;
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

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function calculateCPUPercentage(stats: ContainerStats): number {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  return (cpuDelta / systemDelta) * 100;
}

// Add session type
interface ExtendedSession extends Session {
  user: {
    id: string;
    email: string;
  } & Session['user']
}

// Main API handler
export async function GET() {
  try {
    // Auth check with proper typing
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user with resource limits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        memoryLimit: true,
        storageLimit: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Initialize Docker client and fetch containers
    const docker = getDockerClient();
    const userContainers = await prisma.container.findMany({
      where: { userId: session.user.id }
    });
    const images = await docker.listImages();

    // Initialize stats counters
    let totalMemory = 0;
    let totalCPUPercent = 0;
    let runningContainers = 0;
    let totalSize = 0;
    let totalNetworkIO = 0;

    // Collect container stats
    for (const container of userContainers) {
      try {
        const dockerContainer = docker.getContainer(container.id);
        const stats = await dockerContainer.stats({ stream: false }) as ContainerStats;
        const info = await dockerContainer.inspect();

        if (info.State?.Running) {
          runningContainers++;
          totalMemory += stats.memory_stats.usage || 0;
          totalCPUPercent += calculateCPUPercentage(stats);
          
          // Calculate network I/O from stats
          if (stats.networks) {
            Object.values(stats.networks).forEach(network => {
              totalNetworkIO += network.rx_bytes + network.tx_bytes;
            });
          }
        }

        totalSize += (info as any).SizeRw || 0;
      } catch (error) {
        console.error(`Failed to get stats for container ${container.id}:`, error);
        continue;
      }
    }

    // Determine resource limits based on user role
    const memoryLimit = user.memoryLimit;
    const storageLimit = user.storageLimit;

    // Prepare response
    const systemStats: SystemStats = {
      // Container Stats
      containers: userContainers.length,
      containersRunning: runningContainers,
      containersStopped: userContainers.length - runningContainers,
      containersError: 0, // À implémenter si nécessaire
      
      // Image Stats
      images: images.length,
      
      // User Stats
      totalUsers: 1, // Pour les stats utilisateur, on montre juste l'utilisateur courant
      activeUsers: 1,
      newUsers: 0,
      suspendedUsers: 0,
      
      // System Resources
      cpuCount: os.cpus().length,
      cpuUsage: totalCPUPercent,
      networkIO: totalNetworkIO,
      memoryUsage: {
        used: totalMemory,
        total: memoryLimit,
        percentage: (totalMemory / memoryLimit) * 100
      },
      diskUsage: {
        used: totalSize,
        total: storageLimit,
        percentage: (totalSize / storageLimit) * 100
      }
    };

    return NextResponse.json(systemStats);
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}