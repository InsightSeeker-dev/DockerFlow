import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const container = docker.getContainer(params.id);
    const stats = await container.stats({ stream: false });

    // Calculer l'utilisation du CPU
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuUsage = (cpuDelta / systemDelta) * 100;

    // Calculer l'utilisation de la mémoire
    const memoryUsage = (stats.memory_stats.usage / stats.memory_stats.limit) * 100;

    // Calculer l'utilisation du réseau
    const networkRx = Object.values(stats.networks || {}).reduce((acc: number, net: any) => 
      acc + (net.rx_bytes || 0), 0);
    const networkTx = Object.values(stats.networks || {}).reduce((acc: number, net: any) => 
      acc + (net.tx_bytes || 0), 0);

    // Calculer l'utilisation du disque
    const blockRead = stats.blkio_stats?.io_service_bytes_recursive?.find(
      (stat: any) => stat.op.toLowerCase() === 'read'
    )?.value || 0;
    const blockWrite = stats.blkio_stats?.io_service_bytes_recursive?.find(
      (stat: any) => stat.op.toLowerCase() === 'write'
    )?.value || 0;

    const formattedStats = {
      cpu: {
        usage: parseFloat(cpuUsage.toFixed(2)),
        cores: stats.cpu_stats.online_cpus
      },
      memory: {
        usage: parseFloat(memoryUsage.toFixed(2)),
        used: stats.memory_stats.usage,
        limit: stats.memory_stats.limit
      },
      network: {
        rx_bytes: networkRx,
        tx_bytes: networkTx,
        rx_rate: stats.networks?.eth0?.rx_bytes || 0,
        tx_rate: stats.networks?.eth0?.tx_bytes || 0
      },
      disk: {
        read_bytes: blockRead,
        write_bytes: blockWrite
      },
      pids: stats.pids_stats?.current || 0
    };

    return NextResponse.json(formattedStats);
  } catch (error) {
    console.error('Error getting container stats:', error);
    return NextResponse.json(
      { error: 'Failed to get container statistics' },
      { status: 500 }
    );
  }
}
