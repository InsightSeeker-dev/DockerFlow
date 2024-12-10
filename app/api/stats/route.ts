import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDockerClient } from '@/lib/docker/client';
import { prisma } from '@/lib/prisma';
import { Container as DockerContainer, ContainerInspectInfo } from 'dockerode';
import * as os from 'os';
import { SystemStats } from '@/types/system';
import { Prisma, User } from '@prisma/client';
import { Session } from 'next-auth';
import { getUserStorageUsage } from '@/lib/docker/storage';

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
    role: string;
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
        role: true,
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
        }

        totalSize += (info as any).SizeRw || 0;
      } catch (error) {
        console.error(`Failed to get stats for container ${container.id}:`, error);
        continue;
      }
    }

    // Determine resource limits based on user role
    const isAdmin = user.role === 'ADMIN';
    const memoryLimit = isAdmin ? os.totalmem() : user.memoryLimit;
    const storageLimit = isAdmin ? os.totalmem() : user.storageLimit;

    // Prepare response
    const systemStats: SystemStats = {
      containers: userContainers.length,
      containersRunning: runningContainers,
      containersStopped: userContainers.length - runningContainers,
      images: images.length,
      cpuUsage: totalCPUPercent,
      memoryUsage: {
        used: totalMemory,
        total: memoryLimit,
        percentage: (totalMemory / memoryLimit) * 100
      },
      diskUsage: {
        used: totalSize,
        total: storageLimit,
        percentage: (totalSize / storageLimit) * 100
      },
      resourceLimits: {
        memory: {
          limit: memoryLimit,
          available: Math.max(0, memoryLimit - totalMemory),
          formatted: formatBytes(memoryLimit)
        },
        storage: {
          limit: storageLimit,
          available: Math.max(0, storageLimit - totalSize),
          formatted: formatBytes(storageLimit)
        }
      },
      storage: {
        used: 0,
        total: 0,
        percentage: 0,
        formatted: {
          used: '',
          total: '',
          available: ''
        }
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