import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Docker from 'dockerode';

const docker = new Docker();

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const container = docker.getContainer(params.id);
    const stats = await container.stats({ stream: false });

    // Calculer le pourcentage CPU
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercentage = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

    // Formater les statistiques
    const formattedStats = {
      cpu_percentage: Number(cpuPercentage.toFixed(2)),
      memory_usage: stats.memory_stats?.usage || 0,
      memory_limit: stats.memory_stats?.limit || 0,
      memory_percentage: stats.memory_stats ? ((stats.memory_stats.usage / stats.memory_stats.limit) * 100).toFixed(2) : '0',
      pids: stats.pids_stats?.current || 0,
      network_rx: 0,
      network_tx: 0,
      block_read: 0,
      block_write: 0,
    };

    // Ajouter les statistiques réseau si disponibles
    if (stats.networks) {
      Object.values(stats.networks).forEach((network: any) => {
        formattedStats.network_rx += network.rx_bytes;
        formattedStats.network_tx += network.tx_bytes;
      });
    }

    // Ajouter les statistiques de bloc si disponibles
    if (stats.blkio_stats?.io_service_bytes_recursive) {
      stats.blkio_stats.io_service_bytes_recursive.forEach((stat: any) => {
        if (stat.op === 'Read') formattedStats.block_read += stat.value;
        if (stat.op === 'Write') formattedStats.block_write += stat.value;
      });
    }

    return NextResponse.json(formattedStats);
  } catch (error) {
    console.error('Error fetching container stats:', error);
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    );
  }
}