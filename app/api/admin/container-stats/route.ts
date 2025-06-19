import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import Docker from 'dockerode';

const docker = new Docker();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer les containers de l'utilisateur connecté depuis la BDD
    const dbContainers = await prisma.container.findMany({
      where: { userId: session.user.id },
      select: { dockerId: true }
    });
    const userDockerIds = dbContainers.map(c => c.dockerId);
    console.log('[container-stats] Containers BDD pour user', session.user.id, ':', userContainerNames);

    // Récupérer tous les conteneurs Docker
    const containers = await docker.listContainers({ all: true });
    console.log('[container-stats] Containers Docker trouvés:', containers.map((c: any) => c.Names));

    // Filtrer uniquement ceux appartenant à l'utilisateur
    const backendNames = ['traefik', 'traefik-init', 'mongodb1', 'mongodb2', 'mongodb3'];
    const userContainers = containers.filter((c: { Id: string; Names: string[]; State: string }) => {
      // Exclude backend/system containers by name
      const containerName = c.Names[0]?.replace(/^\//, '');
      if (backendNames.includes(containerName)) return false;
      // Filter by dockerId (Docker ID)
      return userDockerIds.includes(c.Id);
    });
    console.log('[container-stats] Containers filtrés utilisateur:', userContainers.map((c: any) => c.Names));

    // Calculer les statistiques sur les containers utilisateur
    const stats = {
      total: userContainers.length,
      running: userContainers.filter(c => c.State === 'running').length,
      stopped: userContainers.filter(c => c.State === 'exited').length,
      error: userContainers.filter(c => ['restarting', 'dead', 'created'].includes(c.State)).length
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching container stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch container statistics' },
      { status: 500 }
    );
  }
}
