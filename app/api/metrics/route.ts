import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getDiskUsage() {
  try {
    const { stdout } = await execAsync('df -B1 /');
    const lines = stdout.trim().split('\n').slice(1);
    let totalSize = 0;
    let totalFree = 0;

    lines.forEach(line => {
      const [, size, , available] = line.trim().split(/\s+/);
      if (size && available) {
        totalSize += parseInt(size);
        totalFree += parseInt(available);
      }
    });

    const usedPercentage = ((totalSize - totalFree) / totalSize) * 100;
    return Math.round(usedPercentage);
  } catch (error) {
    console.error('Error getting disk usage:', error);
    return 0;
  }
}

async function getNetworkTraffic() {
  try {
    const interfaces = os.networkInterfaces();
    let totalBytes = 0;

    Object.values(interfaces).forEach((iface) => {
      if (iface) {
        iface.forEach((details) => {
          if (details.family === 'IPv4') {
            // Dans un environnement réel, vous devriez utiliser une bibliothèque
            // comme network-speed pour obtenir le trafic réel
            totalBytes += Math.random() * 1000; // Simulation pour l'exemple
          }
        });
      }
    });

    return Math.round((totalBytes / 1024 / 1024) * 100); // Convertir en pourcentage de la capacité
  } catch (error) {
    console.error('Error getting network traffic:', error);
    return 0;
  }
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // CPU Usage
    const cpuUsage = Math.round(
      (os.loadavg()[0] / os.cpus().length) * 100
    );

    // Memory Usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Math.round(
      ((totalMem - freeMem) / totalMem) * 100
    );

    // Disk Usage
    const diskUsage = await getDiskUsage();

    // Network Traffic
    const networkTraffic = await getNetworkTraffic();

    return NextResponse.json({
      cpu: {
        usage: cpuUsage,
        trend: Math.round((Math.random() * 10) - 5) // Simulation de tendance
      },
      memory: {
        usage: memoryUsage,
        trend: Math.round((Math.random() * 10) - 5)
      },
      disk: {
        usage: diskUsage,
        trend: Math.round((Math.random() * 10) - 5)
      },
      network: {
        usage: networkTraffic,
        trend: Math.round((Math.random() * 10) - 5)
      }
    });
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get system metrics' },
      { status: 500 }
    );
  }
}
