import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDockerClient } from '@/lib/docker/client';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const docker = getDockerClient();
    const containers = await docker.listContainers();
    
    const stats = await Promise.all(
      containers.map(async (container) => {
        const stats = await docker.getContainer(container.Id).stats({ stream: false });
        
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuPercent = (cpuDelta / systemDelta) * 100;

        return {
          id: container.Id,
          name: container.Names[0].replace('/', ''),
          cpu: cpuPercent,
          memory: {
            usage: stats.memory_stats.usage,
            limit: stats.memory_stats.limit,
          },
          network: {
            rx_bytes: Object.values(stats.networks || {}).reduce((acc: number, net: any) => acc + net.rx_bytes, 0),
            tx_bytes: Object.values(stats.networks || {}).reduce((acc: number, net: any) => acc + net.tx_bytes, 0),
          },
        };
      })
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Container stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch container stats' },
      { status: 500 }
    );
  }
}