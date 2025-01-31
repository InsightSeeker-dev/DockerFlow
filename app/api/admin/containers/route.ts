import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { docker, getTraefikConfig } from '@/lib/docker';
import { isAdmin } from '@/lib/utils/auth-helpers';
import { getContainerStats } from '@/lib/utils/docker-helpers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ActivityType } from '@prisma/client';

export const dynamic = 'force-dynamic';

// GET /api/admin/containers
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const containers = await docker.listContainers({ all: true });
    const containerPromises = containers
      .filter(container => {
        const name = container.Names[0].replace(/^\//, '');
        // Exclure les conteneurs système
        return !name.includes('traefik') && !name.includes('dockerflow_traefik-init');
      })
      .map(async (container) => {
        const containerInstance = docker.getContainer(container.Id);
        const inspectData = await containerInstance.inspect();
        const stats = await getContainerStats(containerInstance);

        // Extraire le sous-domaine des labels Traefik
        const labels = inspectData.Config?.Labels || {};
        let subdomain = '';
        let fullHostname = '';

        // Chercher le sous-domaine dans les labels Traefik
        for (const [key, value] of Object.entries(labels)) {
          if (key.includes('traefik.http.routers') && key.endsWith('.rule')) {
            const match = value.match(/Host\(`([^`]+)`\)/);
            if (match) {
              fullHostname = match[1];
              // Extraire le sous-domaine de l'URL complète (ex: grafana.dockersphere.ovh -> grafana)
              subdomain = match[1].split('.')[0];
              break;
            }
          }
        }

        const containerInfo = {
          id: container.Id,
          name: container.Names[0].replace(/^\//, ''),
          image: container.Image,
          state: container.State,
          status: container.Status,
          created: new Date(container.Created * 1000).toISOString(),
          ports: container.Ports,
          subdomain: subdomain,
          fullHostname: fullHostname,
          stats,
          ...inspectData,
        };

        // Filter by status if provided
        if (status && containerInfo.state !== status) {
          return null;
        }

        // Filter by search term if provided
        if (search) {
          const searchLower = search.toLowerCase();
          const matchesSearch = 
            containerInfo.name.toLowerCase().includes(searchLower) ||
            containerInfo.image.toLowerCase().includes(searchLower) ||
            containerInfo.subdomain.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) {
            return null;
          }
        }

        return containerInfo;
      });

    const results = (await Promise.all(containerPromises)).filter(Boolean);
    return NextResponse.json(results);
  } catch (error) {
    console.error('[CONTAINERS_LIST]', error);
    return NextResponse.json(
      { error: 'Failed to list containers' },
      { status: 500 }
    );
  }
}

const createContainerSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-zA-Z0-9-]+$/, 'Container name must contain only letters, numbers, and hyphens'),
  image: z.string(),
  subdomain: z.string().min(1).max(63).regex(/^[a-zA-Z0-9-]+$/, 'Subdomain must contain only letters, numbers, and hyphens'),
  ports: z.array(z.tuple([z.string(), z.string()])),
  volumes: z.array(z.tuple([z.string(), z.string()])).optional(),
  env: z.array(z.tuple([z.string(), z.string()])).optional(),
});

// POST /api/admin/containers
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const result = createContainerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.issues },
        { status: 400 }
      );
    }

    const { name, image, subdomain, ports, volumes, env } = result.data;

    // Vérifier si le sous-domaine est déjà utilisé
    const existingContainer = await prisma.container.findFirst({
      where: {
        OR: [
          { name },
          { env: { equals: { VIRTUAL_HOST: `${subdomain}.dockersphere.ovh` } } }
        ]
      }
    });

    if (existingContainer) {
      return NextResponse.json(
        { error: 'Container name or subdomain already in use' },
        { status: 400 }
      );
    }

    // Créer le conteneur avec la configuration Traefik
    const containerConfig = {
      Image: image,
      name,
      Labels: {
        ...getTraefikConfig(name, subdomain, ports[0][1]), // Utiliser le premier port comme port principal
      },
      ExposedPorts: ports.reduce((acc, [_, containerPort]) => ({
        ...acc,
        [`${containerPort}/tcp`]: {}
      }), {}),
      HostConfig: {
        PortBindings: ports.reduce((acc, [hostPort, containerPort]) => ({
          ...acc,
          [`${containerPort}/tcp`]: [{ HostPort: hostPort }]
        }), {}),
        Binds: volumes?.map(([host, container]) => `${host}:${container}`) || [],
        RestartPolicy: {
          Name: 'unless-stopped'
        },
        NetworkMode: 'proxy' // Utiliser le réseau proxy de Traefik
      },
      Env: [
        ...(env?.map(([key, value]) => `${key}=${value}`) || [])
      ]
    };

    const container = await docker.createContainer(containerConfig);
    await container.start();

    // Créer l'entrée dans la base de données
    const dbContainer = await prisma.container.create({
      data: {
        name,
        imageId: image,
        status: 'running',
        userId: session.user.id,
        ports: Object.fromEntries(ports),
        volumes: volumes ? Object.fromEntries(volumes) : {},
        env: {
          ...Object.fromEntries(env || []),
          VIRTUAL_HOST: `${subdomain}.dockersphere.ovh`,
          LETSENCRYPT_HOST: `${subdomain}.dockersphere.ovh`
        },
        subdomain,
        cpuLimit: 0,
        memoryLimit: 0
      }
    });

    // Enregistrer l'activité
    await prisma.activity.create({
      data: {
        type: ActivityType.CONTAINER_CREATE,
        userId: session.user.id,
        description: `Created container ${name} with subdomain ${subdomain}.dockersphere.ovh`,
        metadata: {
          containerId: container.id,
          containerName: name,
          image,
          subdomain: `${subdomain}.dockersphere.ovh`
        }
      }
    });

    return NextResponse.json({
      id: container.id,
      name,
      subdomain: `${subdomain}.dockersphere.ovh`,
      message: 'Container created successfully'
    });
  } catch (error) {
    console.error('Error creating container:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create container';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
