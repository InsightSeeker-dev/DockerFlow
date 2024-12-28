import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDockerClient } from '@/lib/docker/client';
import os from 'os';
import { SystemStats } from '@/types/system';
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';
import { UserStatus } from '@prisma/client';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Récupérer les limites de l'utilisateur depuis la base de données
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
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

    const docker = getDockerClient();

    // Get container information
    const containers = await docker.listContainers({ all: true });
    const containersRunning = containers.filter(
      (container) => container.State === 'running'
    ).length;

    // Get image information
    const images = await docker.listImages();

    // Get system statistics
    const cpus = os.cpus();
    const cpuUsage = getCpuUsage(cpus);
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Get network usage
    let totalNetworkIO = 0;
    const runningContainers = containers.filter(c => c.State === 'running');
    
    for (const container of runningContainers) {
      try {
        const dockerContainer = docker.getContainer(container.Id);
        const stats = await dockerContainer.stats({ stream: false });
        
        if (stats.networks) {
          Object.values(stats.networks).forEach(network => {
            totalNetworkIO += (network.rx_bytes || 0) + (network.tx_bytes || 0);
          });
        }
      } catch (error) {
        console.error(`Failed to get network stats for container ${container.Id}:`, error);
      }
    }

    // Get disk usage
    const { used: diskUsed, total: diskTotal } = await getDiskUsage();

    // Calculate total image size
    const totalImageSize = images.reduce((acc, img) => acc + (img.Size || 0), 0);

    const stats: SystemStats = {
      // Container Stats
      containers: containers.length,
      containersRunning: containers.filter(c => c.State === 'running').length,
      containersStopped: containers.filter(c => c.State !== 'running').length,
      containersError: containers.filter(c => !['running', 'exited'].includes(c.State)).length,
      containerTrend: 0,
      
      // Image Stats
      images: {
        total: images.length,
        size: totalImageSize,
        pulls: 0,
        tags: images.map(img => ({
          name: img.RepoTags?.[0] || 'none',
          count: img.RepoTags?.length || 0
        }))
      },
      
      // User Stats
      totalUsers: await prisma.user.count(),
      activeUsers: await prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      newUsers: await prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      suspendedUsers: await prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      userTrend: 0,
      
      // System Resources
      cpuCount: cpus.length,
      cpuUsage: cpuUsage,
      cpuTrend: 0,
      
      memoryUsage: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      memoryTrend: 0,

      diskUsage: {
        total: diskTotal,
        used: diskUsed,
        free: diskTotal - diskUsed,
        percentage: (diskUsed / diskTotal) * 100
      },

      networkTraffic: {
        in: totalNetworkIO / 2,
        out: totalNetworkIO / 2
      },

      performanceHistory: [{
        timestamp: new Date().toISOString(),
        cpu: cpuUsage,
        memory: (usedMemory / totalMemory) * 100,
        network: totalNetworkIO
      }]
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system statistics' },
      { status: 500 }
    );
  }
}

function getCpuUsage(cpus: os.CpuInfo[]): number {
  const totalCpu = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0);

  return totalCpu / cpus.length;
}

async function getDiskUsage(): Promise<{ used: number; total: number }> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('powershell "Get-PSDrive C | Select-Object Used,Free"');
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const [used, free] = lines[1]
          .trim()
          .split(/\s+/)
          .map((n) => parseInt(n));
        const total = used + free;
        return { used, total };
      }
      throw new Error('Unable to parse disk usage');
    } else {
      const { stdout } = await execAsync("df / | tail -1 | awk '{print $3,$2}'");
      const [used, total] = stdout
        .trim()
        .split(' ')
        .map((n) => parseInt(n) * 1024); // Convert to bytes
      return { used, total };
    }
  } catch (error) {
    console.error('Error getting disk usage:', error);
    // Fallback to using memory stats if disk stats fail
    const total = os.totalmem();
    const free = os.freemem();
    return {
      total,
      used: total - free,
    };
  }
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}