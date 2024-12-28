import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

interface DiskInfo {
  device: string;
  size: number;
  used: number;
  available: number;
  mountpoint: string;
}

export async function getDiskUsage(): Promise<DiskInfo[]> {
  try {
    const { stdout } = await execAsync('df -B1 /');
    const lines = stdout.trim().split('\n').slice(1);
    return lines.map(line => {
      const [device, size, used, available, , mountpoint] = line.trim().split(/\s+/);
      return {
        device,
        size: parseInt(size, 10),
        used: parseInt(used, 10),
        available: parseInt(available, 10),
        mountpoint
      };
    });
  } catch (error) {
    console.error('Error getting disk usage:', error);
    return [];
  }
}

export async function getSystemMetrics() {
  const cpuUsage = os.loadavg()[0];
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
  const disks = await getDiskUsage();

  return {
    cpu: {
      usage: cpuUsage,
      cores: os.cpus().length
    },
    memory: {
      total: totalMemory,
      free: freeMemory,
      used: totalMemory - freeMemory,
      usage: memoryUsage
    },
    disks
  };
}
