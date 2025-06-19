import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDockerClient } from '@/lib/docker/client';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Récupérer les containers de l'utilisateur connecté depuis la BDD
    const dbContainers = await prisma.container.findMany({
      where: { userId: session.user.id },
      select: { dockerId: true }
    });
    const userDockerIds = dbContainers.map(c => c.dockerId);
    console.log('[containers/stats] Containers BDD pour user', session.user.id, ':', userContainerNames);

    const docker = getDockerClient();
    const containers = await docker.listContainers();
    console.log('[containers/stats] Containers Docker trouvés:', containers.map((c: any) => c.Names));

    // Filtrer uniquement ceux appartenant à l'utilisateur
    const backendNames = ['traefik', 'traefik-init', 'mongodb1', 'mongodb2', 'mongodb3'];
    const userContainers = containers.filter((c: { Id: string; Names: string[]; State: string }) => {
      // Exclude backend/system containers by name
      const containerName = c.Names[0]?.replace(/^\//, '');
      if (backendNames.includes(containerName)) return false;
      // Filter by dockerId (Docker ID)
      return userDockerIds.includes(c.Id);
    });
    console.log('[containers/stats] Containers filtrés utilisateur:', userContainers.map((c: any) => c.Names));

    const stats = await Promise.all(
      userContainers.map(async (container) => {
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