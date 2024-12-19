import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

export const dynamic = 'force-dynamic';

// Fonction utilitaire pour obtenir les statistiques d'un conteneur
async function getContainerStats(container: Docker.Container) {
  try {
    const stats = await container.stats({ stream: false });
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuUsage = (cpuDelta / systemDelta) * 100;
    
    const memoryUsage = (stats.memory_stats.usage / stats.memory_stats.limit) * 100;
    
    return {
      cpu: parseFloat(cpuUsage.toFixed(2)),
      memory: parseFloat(memoryUsage.toFixed(2))
    };
  } catch (error) {
    console.error('Error getting container stats:', error);
    return { cpu: 0, memory: 0 };
  }
}

// GET /api/admin/containers
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const containers = await docker.listContainers({ all: true });
    const containerPromises = containers.map(async (container) => {
      const containerInstance = docker.getContainer(container.Id);
      const inspectData = await containerInstance.inspect();
      const stats = await getContainerStats(containerInstance);

      const containerInfo = {
        id: container.Id,
        name: container.Names[0].replace(/^\//, ''),
        image: container.Image,
        state: container.State,
        status: container.Status,
        created: new Date(container.Created * 1000).toISOString(),
        ports: container.Ports.map(port => 
          `${port.PublicPort}:${port.PrivatePort}/${port.Type}`
        ),
        networks: Object.keys(inspectData.NetworkSettings.Networks),
        cpu: stats.cpu,
        memory: stats.memory
      };

      // Filtrage par statut
      if (status && status !== 'all' && container.State !== status) {
        return null;
      }

      // Filtrage par recherche
      if (search && !containerInfo.name.toLowerCase().includes(search.toLowerCase()) &&
          !containerInfo.image.toLowerCase().includes(search.toLowerCase())) {
        return null;
      }

      return containerInfo;
    });

    const formattedContainers = (await Promise.all(containerPromises))
      .filter(container => container !== null);

    return NextResponse.json(formattedContainers);
  } catch (error) {
    console.error('Error fetching containers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch containers' },
      { status: 500 }
    );
  }
}

// POST /api/admin/containers
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, image, ports, env, volumes } = body;

    // Préparer les configurations du conteneur
    const portBindings: any = {};
    const exposedPorts: any = {};
    
    if (ports) {
      ports.split(',').forEach((port: string) => {
        const [hostPort, containerPort] = port.trim().split(':');
        portBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }];
        exposedPorts[`${containerPort}/tcp`] = {};
      });
    }

    // Préparer les variables d'environnement
    const envArray = env ? env.split(',').map((e: string) => e.trim()) : [];

    // Préparer les volumes
    const volumeBindings = volumes ? volumes.split(',').map((v: string) => v.trim()) : [];

    // Créer et démarrer le conteneur
    const container = await docker.createContainer({
      Image: image,
      name: name,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        Binds: volumeBindings
      },
      Env: envArray
    });

    await container.start();

    return NextResponse.json({ 
      message: 'Container created successfully',
      id: container.id 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating container:', error);
    return NextResponse.json(
      { error: 'Failed to create container' },
      { status: 500 }
    );
  }
}
