import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import os from 'os';
import { SystemStats } from '@/types/system';
import { prisma } from '@/lib/prisma';

const docker = new Docker();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DockerStatus {
  key: string;
  value: string;
}

export async function GET() {
  try {
    console.log('Starting GET request to /api/admin/system/stats');
    
    const session = await getServerSession(authOptions);
    console.log('Session:', session?.user);
    
    if (!session?.user || !['ADMIN', 'admin', 'SUPER_ADMIN', 'super_admin'].includes(session.user.role.toLowerCase())) {
      console.log('Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Vous devez être administrateur pour accéder à ces statistiques' },
        { status: 401 }
      );
    }

    // Récupérer les statistiques des conteneurs
    console.log('Fetching container stats...');
    const containers = await docker.listContainers({ all: true });
    const runningContainers = containers.filter(
      (container) => container.State === 'running'
    );
    const stoppedContainers = containers.filter(
      (container) => container.State === 'exited'
    );
    const errorContainers = containers.filter(
      (container) => !['running', 'exited'].includes(container.State)
    );

    // Récupérer le nombre d'images
    console.log('Fetching images...');
    const images = await docker.listImages();

    // Récupérer les statistiques utilisateurs avec une seule requête
    console.log('Fetching user stats...');
    const [totalUsers, activeUsers, newUsers, suspendedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { status: 'ACTIVE' }
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Dernières 24h
          }
        }
      }),
      prisma.user.count({
        where: { status: 'SUSPENDED' }
      })
    ]);

    // Récupérer l'utilisation CPU avec une moyenne plus précise
    console.log('Calculating CPU usage...');
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    
    // Calculer l'utilisation CPU moyenne sur tous les cœurs
    // Utiliser une fenêtre de temps plus courte pour plus de précision
    const cpuUsage = await new Promise<number>((resolve) => {
      const startMeasure = cpus.map(cpu => ({
        idle: cpu.times.idle,
        total: Object.values(cpu.times).reduce((a, b) => a + b)
      }));
      
      setTimeout(() => {
        const endMeasure = os.cpus().map(cpu => ({
          idle: cpu.times.idle,
          total: Object.values(cpu.times).reduce((a, b) => a + b)
        }));
        
        const cpuUsage = startMeasure.map((start, i) => {
          const end = endMeasure[i];
          const idleDiff = end.idle - start.idle;
          const totalDiff = end.total - start.total;
          return ((totalDiff - idleDiff) / totalDiff) * 100;
        });
        
        resolve(cpuUsage.reduce((a, b) => a + b) / cpuCount);
      }, 1000);
    });

    // Récupérer l'utilisation mémoire
    console.log('Calculating memory usage...');
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Récupérer l'utilisation disque avec des unités correctes
    console.log('Calculating disk usage...');
    const dockerInfo = await docker.info();
    const driverStatus = dockerInfo.DriverStatus as [string, string][] || [];
    
    const parseSize = (size: string): number => {
      const units = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024,
        'TB': 1024 * 1024 * 1024 * 1024
      };
      
      const match = size.match(/^([\d.]+)\s*([A-Z]+)$/);
      if (!match) return 0;
      
      const value = parseFloat(match[1]);
      const unit = match[2];
      return value * (units[unit as keyof typeof units] || 1);
    };
    
    const diskUsed = driverStatus.find(
      ([key]) => key === 'Data Space Used'
    )?.[1] || '0 B';
    const diskTotal = driverStatus.find(
      ([key]) => key === 'Data Space Total'
    )?.[1] || '0 B';

    const diskUsedBytes = parseSize(diskUsed);
    const diskTotalBytes = parseSize(diskTotal);
    const diskPercentage = (diskUsedBytes / diskTotalBytes) * 100;

    // Calculer le réseau IO avec une moyenne sur le temps
    console.log('Calculating network I/O...');
    const getNetworkStats = async (): Promise<number> => {
      try {
        const stats = await Promise.all(
          runningContainers.map(async container => {
            try {
              const containerStats = await docker.getContainer(container.Id).stats({ stream: false });
              const networks = containerStats.networks || {};
              return Object.values(networks).reduce((acc, network: any) => {
                const rx_bytes = network?.rx_bytes || 0;
                const tx_bytes = network?.tx_bytes || 0;
                return acc + rx_bytes + tx_bytes;
              }, 0);
            } catch (error) {
              console.error(`Error getting stats for container ${container.Id}:`, error);
              return 0;
            }
          })
        );
        
        return stats.reduce((acc, bytes) => acc + bytes, 0);
      } catch (error) {
        console.error('Error calculating network stats:', error);
        return 0;
      }
    };

    let networkIO = 0;
    try {
      // Prendre plusieurs mesures pour plus de précision
      const measurements = 3;
      const interval = 1000; // 1 seconde entre chaque mesure
      
      const samples: number[] = [];
      let lastMeasurement = await getNetworkStats();
      
      for (let i = 0; i < measurements; i++) {
        await new Promise(resolve => setTimeout(resolve, interval));
        const currentMeasurement = await getNetworkStats();
        const throughput = Math.max(0, (currentMeasurement - lastMeasurement)) / interval * 1000; // bytes per second
        samples.push(throughput);
        lastMeasurement = currentMeasurement;
      }

      // Calculer la moyenne en excluant les valeurs aberrantes
      samples.sort((a, b) => a - b);
      const validSamples = samples.slice(1, -1); // Exclure le min et max
      networkIO = validSamples.reduce((acc, val) => acc + val, 0) / validSamples.length / 1024 / 1024; // Convertir en MB/s
    } catch (error) {
      console.error('Error measuring network I/O:', error);
      networkIO = 0;
    }

    const stats: SystemStats = {
      // Container Stats
      containers: containers.length,
      containersRunning: runningContainers.length,
      containersStopped: stoppedContainers.length,
      containersError: errorContainers.length,
      containerTrend: ((runningContainers.length - stoppedContainers.length) / containers.length) * 100,

      // Image Stats
      images: {
        total: images.length,
        size: images.reduce((acc, img) => acc + img.Size, 0),
        pulls: images.reduce((acc, img) => acc + (img.RepoTags?.length || 0), 0),
        tags: Object.entries(
          images.reduce((acc, img) => {
            (img.RepoTags || []).forEach(tag => {
              acc[tag] = (acc[tag] || 0) + 1;
            });
            return acc;
          }, {} as Record<string, number>)
        )
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      },

      // User Stats
      totalUsers,
      activeUsers,
      newUsers,
      suspendedUsers,
      userTrend: ((newUsers - suspendedUsers) / Math.max(totalUsers, 1)) * 100,

      // System Resources
      cpuUsage: Math.round(cpuUsage),
      cpuCount: os.cpus().length,
      cpuTrend: 0,

      memoryUsage: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentage: Math.round(memoryPercentage)
      },
      memoryTrend: 0,

      diskUsage: {
        total: diskTotalBytes,
        used: diskUsedBytes,
        free: diskTotalBytes - diskUsedBytes,
        percentage: Math.round(diskPercentage)
      },

      networkTraffic: {
        in: networkIO / 2,
        out: networkIO / 2
      },

      // Performance History
      performanceHistory: [
        {
          timestamp: new Date().toLocaleTimeString(),
          cpu: Math.round(cpuUsage),
          memory: Math.round(memoryPercentage),
          network: networkIO
        }
      ]
    };

    console.log('Returning stats:', stats);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error in /api/admin/system/stats:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de la récupération des statistiques' },
      { status: 500 }
    );
  }
}
