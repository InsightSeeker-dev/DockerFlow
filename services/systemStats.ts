import { SystemStats } from '@/types/system';
import os from 'os';
import { execSync } from 'child_process';
import Docker from 'dockerode';

const docker = new Docker();

// Garder un historique des performances en mémoire
let performanceHistory: Array<{
  timestamp: string;
  cpu: number;
  memory: number;
  network: number;
}> = [];

// Limiter l'historique à 20 points
const MAX_HISTORY_POINTS = 20;

export async function getSystemStats(): Promise<SystemStats> {
  try {
    // Docker Stats
    const containers = await docker.listContainers({ all: true });
    const images = await docker.listImages();
    const imageStats = await getImageStats(images);

    // System Resources
    const cpuUsage = await getCPUUsage();
    const memoryStats = getMemoryStats();
    const diskStats = await getDiskStats();
    const networkStats = await getNetworkStats();

    // User Stats (à adapter selon votre système d'authentification)
    const userStats = await getUserStats();

    // Mettre à jour l'historique des performances
    const currentTimestamp = new Date().toISOString();
    performanceHistory.push({
      timestamp: currentTimestamp,
      cpu: cpuUsage,
      memory: memoryStats.percentage,
      network: (networkStats.in + networkStats.out) / (1024 * 1024) // MB/s
    });

    // Garder seulement les 20 derniers points
    if (performanceHistory.length > MAX_HISTORY_POINTS) {
      performanceHistory = performanceHistory.slice(-MAX_HISTORY_POINTS);
    }

    return {
      // Container Stats
      containers: containers.length,
      containersRunning: containers.filter(c => c.State === 'running').length,
      containersStopped: containers.filter(c => c.State === 'exited').length,
      containersError: containers.filter(c => c.State === 'error').length,
      containerTrend: 0, // À calculer en comparant avec les données précédentes

      // Image Stats
      images: {
        total: images.length,
        size: imageStats.totalSize,
        pulls: imageStats.totalPulls,
        tags: imageStats.popularTags
      },

      // User Stats
      ...userStats,

      // System Resources
      cpuUsage,
      cpuCount: os.cpus().length,
      cpuTrend: 0,
      
      memoryUsage: memoryStats,
      memoryTrend: 0,
      
      diskUsage: diskStats,
      
      networkTraffic: networkStats,

      // Performance History
      performanceHistory: performanceHistory.map(point => ({
        ...point,
        timestamp: new Date(point.timestamp).toLocaleTimeString()
      }))
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    throw error;
  }
}

async function getImageStats(images: Docker.ImageInfo[]) {
  const totalSize = images.reduce((acc, img) => acc + img.Size, 0);
  const tags = images
    .flatMap(img => img.RepoTags || [])
    .reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const popularTags = Object.entries(tags)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalSize,
    totalPulls: await getTotalPulls(),
    popularTags
  };
}

async function getTotalPulls() {
  try {
    const images = await docker.listImages();
    // Cette valeur devrait idéalement venir de votre registre Docker
    // Pour l'exemple, nous utilisons une estimation
    return images.length * 2;
  } catch (error) {
    console.error('Error getting total pulls:', error);
    return 0;
  }
}

async function getCPUUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startMeasure = os.cpus().map(cpu => cpu.times);
    
    setTimeout(() => {
      const endMeasure = os.cpus().map(cpu => cpu.times);
      const totalDiff = endMeasure.map((end, i) => {
        const start = startMeasure[i];
        const idle = end.idle - start.idle;
        const total = Object.values(end).reduce((acc, val) => acc + val, 0) -
                     Object.values(start).reduce((acc, val) => acc + val, 0);
        return 100 * (1 - idle / total);
      });
      
      resolve(Math.round(totalDiff.reduce((acc, val) => acc + val, 0) / totalDiff.length));
    }, 100);
  });
}

function getMemoryStats() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percentage = Math.round((used / total) * 100);

  return {
    total,
    used,
    free,
    percentage
  };
}

async function getDiskStats() {
  try {
    // Pour Windows
    const df = execSync('wmic logicaldisk get size,freespace,caption').toString();
    const disks = df.trim().split('\n').slice(1);
    
    let total = 0;
    let free = 0;

    disks.forEach(disk => {
      const [caption, freeSpace, size] = disk.trim().split(/\s+/);
      if (size && freeSpace) {
        total += parseInt(size);
        free += parseInt(freeSpace);
      }
    });

    const used = total - free;
    const percentage = Math.round((used / total) * 100);

    return {
      total,
      used,
      free,
      percentage
    };
  } catch (error) {
    console.error('Error getting disk stats:', error);
    return {
      total: 0,
      used: 0,
      free: 0,
      percentage: 0
    };
  }
}

async function getNetworkStats() {
  try {
    // Pour une mesure plus précise, il faudrait stocker les valeurs précédentes
    // et calculer la différence sur un intervalle de temps
    const networkInterfaces = os.networkInterfaces();
    let bytesIn = 0;
    let bytesOut = 0;

    Object.values(networkInterfaces).forEach(interfaces => {
      interfaces?.forEach(interface_ => {
        if (!interface_.internal) {
          // Ces valeurs devraient idéalement venir d'une source plus précise
          bytesIn += Math.random() * 1024 * 1024; // Simulation pour l'exemple
          bytesOut += Math.random() * 1024 * 1024;
        }
      });
    });

    return {
      in: bytesIn,
      out: bytesOut
    };
  } catch (error) {
    console.error('Error getting network stats:', error);
    return {
      in: 0,
      out: 0
    };
  }
}

async function getUserStats() {
  // À adapter selon votre système d'authentification
  return {
    totalUsers: 10,
    activeUsers: 5,
    newUsers: 2,
    suspendedUsers: 1,
    userTrend: 10
  };
}
