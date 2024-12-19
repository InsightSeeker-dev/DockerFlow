import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import os from 'os';
import { SystemStats } from '@/types/system';

const docker = new Docker();

export const dynamic = 'force-dynamic';

interface DockerStatus {
  key: string;
  value: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer les statistiques des conteneurs
    const containers = await docker.listContainers({ all: true });
    const runningContainers = containers.filter(
      (container) => container.State === 'running'
    );
    const stoppedContainers = containers.filter(
      (container) => container.State !== 'running'
    );

    // Récupérer le nombre d'images
    const images = await docker.listImages();

    // Récupérer l'utilisation CPU
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    
    // Calculer l'utilisation CPU moyenne sur tous les cœurs
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpuCount;

    // Récupérer l'utilisation mémoire
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Récupérer l'utilisation disque
    const dockerInfo = await docker.info();
    const driverStatus = dockerInfo.DriverStatus as [string, string][] || [];
    
    const diskUsed = driverStatus.find(
      ([key]) => key === 'Data Space Used'
    )?.[1] || '0';
    const diskTotal = driverStatus.find(
      ([key]) => key === 'Data Space Total'
    )?.[1] || '0';

    // Convertir les valeurs de chaîne en nombres (retirer les unités et convertir)
    const diskUsedBytes = parseInt(diskUsed) || 0;
    const diskTotalBytes = parseInt(diskTotal) || 0;
    const diskPercentage = (diskUsedBytes / diskTotalBytes) * 100;

    // Calculer le réseau IO (exemple simple)
    const networkIO = 0; // À implémenter avec les vraies statistiques réseau

    const stats: SystemStats = {
      containers: containers.length,
      containersRunning: runningContainers.length,
      containersStopped: stoppedContainers.length,
      images: images.length,
      cpuUsage,
      cpuCount,
      networkIO,
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: memoryPercentage,
      },
      diskUsage: {
        used: diskUsedBytes,
        total: diskTotalBytes,
        percentage: diskPercentage,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system stats' },
      { status: 500 }
    );
  }
}
