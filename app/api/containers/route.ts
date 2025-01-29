import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { checkStorageLimit, getImageSize } from '@/lib/docker/storage';
import { pullImage } from '@/lib/docker/images';
import { Session } from 'next-auth';
import { Prisma, ActivityType } from '@prisma/client';
import { ovhDNSService } from '@/lib/ovh/dns-service';
import { ContainerCreateOptions, ContainerInfo } from 'dockerode';
import { suggestAlternativePort } from '@/lib/docker/ports';

interface ExtendedSession extends Session {
  user: {
    id: string;
    email: string;
    role: string;
  } & Session['user']
}

interface DockerPort {
  IP: string;
  PrivatePort: number;
  PublicPort: number;
  Type: string;
}

interface ExtendedHostConfig {
  NetworkMode: string;
  NanoCpus?: number;
  Memory?: number;
}

interface ExtendedContainerInfo extends Omit<ContainerInfo, 'HostConfig'> {
  HostConfig?: ExtendedHostConfig;
}

const createContainerSchema = z.object({
  name: z.string(),
  image: z.string(),
  subdomain: z.string().min(3).max(63).regex(/^[a-zA-Z0-9-]+$/, 'Subdomain must contain only letters, numbers, and hyphens'),
  ports: z.array(z.object({
    hostPort: z.number(),
    containerPort: z.number()
  })),
  volumes: z.array(z.object({
    name: z.string(),
    mountPath: z.string()
  })),
  env: z.array(z.object({
    key: z.string(),
    value: z.string()
  })).optional()
});

type CreateContainerRequest = z.infer<typeof createContainerSchema>;

const containerActionSchema = z.object({
  action: z.enum(['start', 'stop', 'remove']),
  containerId: z.string(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const docker = getDockerClient();
    const containers = await docker.listContainers({ all: true }) as unknown as ExtendedContainerInfo[];
    
    console.log('Raw containers data:', JSON.stringify(containers, null, 2));
    
    // Get user's containers from database with names and subdomains
    const userContainers = await prisma.container.findMany({
      where: { userId: session.user.id },
      select: { 
        name: true,
        subdomain: true 
      },
    });
    
    // Create a map of container names to their database info
    const containerInfoMap = new Map(
      userContainers.map(container => [container.name, container])
    );
    
    // Filter and enrich Docker containers with database info
    const filteredContainers = containers
      .filter(container => {
        const containerName = container.Names[0]?.replace('/', '');
        return containerName && containerInfoMap.has(containerName);
      })
      .map(container => {
        const containerName = container.Names[0]?.replace('/', '');
        const dbInfo = containerInfoMap.get(containerName);

        // Transformer les ports Docker en format attendu
        console.log('Container ports before transform:', container.Ports);
        const ports = container.Ports?.map(port => {
          console.log('Processing port:', port);
          return {
            hostPort: port.PublicPort,
            containerPort: port.PrivatePort
          };
        }) || [];
        console.log('Transformed ports:', ports);

        return {
          id: container.Id,
          name: containerName,
          imageId: container.Image,
          status: container.State,
          created: container.Created,
          ports,
          network: container.HostConfig?.NetworkMode,
          subdomain: dbInfo?.subdomain,
          cpuLimit: container.HostConfig?.NanoCpus ? container.HostConfig.NanoCpus / 1e9 : 0,
          memoryLimit: container.HostConfig?.Memory || 0
        };
      });
    
    console.log('Final filtered containers:', JSON.stringify(filteredContainers, null, 2));
    return NextResponse.json({ containers: filteredContainers });
  } catch (error) {
    console.error('Container API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch containers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = createContainerSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.issues },
        { status: 400 }
      );
    }

    const { name, image: imageName, subdomain, ports, volumes, env } = result.data;

    // Vérifier si le sous-domaine est déjà utilisé
    const existingContainer = await prisma.container.findFirst({
      where: {
        OR: [
          { name },
          { subdomain }
        ]
      }
    });

    if (existingContainer) {
      return NextResponse.json(
        { error: 'Container name or subdomain already in use' },
        { status: 400 }
      );
    }

    // Vérifier la limite de stockage
    const imageSize = await getImageSize(imageName);
    const hasSpace = await checkStorageLimit(session.user.id, imageSize);
    
    if (!hasSpace) {
      return NextResponse.json(
        { error: 'Storage limit exceeded' },
        { status: 400 }
      );
    }

    // Trouver un port disponible pour chaque port demandé
    const mappedPorts = await Promise.all(ports.map(async (port) => ({
      ...port,
      hostPort: await suggestAlternativePort(port.containerPort)
    })));

    const docker = getDockerClient();

    // Créer les volumes Docker si nécessaire
    for (const volume of volumes) {
      try {
        await docker.createVolume({
          Name: volume.name,
          Driver: 'local'
        });
      } catch (error) {
        console.error(`Failed to create volume ${volume.name}:`, error);
      }
    }

    // Préparer la configuration du conteneur
    const containerConfig: ContainerCreateOptions = {
      Image: imageName,
      name,
      ExposedPorts: mappedPorts.reduce((acc, { containerPort }) => ({
        ...acc,
        [`${containerPort}/tcp`]: {}
      }), {} as Record<string, {}>),
      HostConfig: {
        PortBindings: mappedPorts.reduce((acc, { hostPort, containerPort }) => ({
          ...acc,
          [`${containerPort}/tcp`]: [{ HostPort: hostPort.toString() }]
        }), {} as Record<string, Array<{ HostPort: string }>>),
        Binds: volumes.map(v => `${v.name}:${v.mountPath}`),
      },
      Env: env ? env.map(e => `${e.key}=${e.value}`) : [],
      Labels: {
        'traefik.enable': 'true',
        [`traefik.http.routers.${name}.rule`]: `Host(\`${subdomain}.dockersphere.ovh\`)`,
        [`traefik.http.services.${name}.loadbalancer.server.port`]: mappedPorts[0].containerPort.toString()
      }
    };

    // Créer et démarrer le conteneur
    const container = await docker.createContainer(containerConfig);
    await container.start();

    // Enregistrer le conteneur dans la base de données
    await prisma.container.create({
      data: {
        id: container.id,
        name,
        imageId: imageName,
        subdomain,
        userId: session.user.id,
        status: 'running',
        created: new Date(),
        ports: mappedPorts as Prisma.JsonValue,
        volumes: volumes as Prisma.JsonValue,
        env: env as Prisma.JsonValue,
        cpuLimit: 0,
        memoryLimit: 0
      }
    });

    // Enregistrer l'activité
    await prisma.activity.create({
      data: {
        type: ActivityType.CONTAINER_CREATE,
        userId: session.user.id,
        description: `Created container ${name} with ports ${mappedPorts.map(p => `${p.hostPort}->${p.containerPort}`).join(', ')}`,
        metadata: {
          containerId: container.id,
          containerName: name,
          image: imageName,
          ports: mappedPorts
        }
      }
    });

    return NextResponse.json({ 
      id: container.id,
      ports: mappedPorts
    });
  } catch (error: any) {
    console.error('Error creating container:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create container' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const validatedData = containerActionSchema.parse(data);
    const { action, containerId } = validatedData;

    const docker = getDockerClient();
    const container = docker.getContainer(containerId);

    // Vérifier si le conteneur existe
    const containerInfo = await container.inspect();
    const containerName = containerInfo.Name.replace('/', '');

    switch (action) {
      case 'start':
        await container.start();
        await prisma.activity.create({
          data: {
            type: ActivityType.CONTAINER_START,
            userId: session.user.id,
            description: `Started container ${containerName}`,
            metadata: {
              containerId,
              containerName,
              status: containerInfo.State
            }
          }
        });
        break;

      case 'stop':
        await container.stop();
        await prisma.activity.create({
          data: {
            type: ActivityType.CONTAINER_STOP,
            userId: session.user.id,
            description: `Stopped container ${containerName}`,
            metadata: {
              containerId,
              containerName,
              status: containerInfo.State
            }
          }
        });
        break;

      case 'remove':
        // Supprimer le sous-domaine DNS
        try {
          const env = containerInfo.Config.Env || [];
          const virtualHostEnv = env.find(e => e.startsWith('VIRTUAL_HOST='));
          if (virtualHostEnv) {
            const subdomain = virtualHostEnv.split('=')[1].split('.')[0];
            await ovhDNSService.removeSubdomain(subdomain);
          }
        } catch (error) {
          console.error('Erreur lors de la suppression du sous-domaine:', error);
        }

        await container.remove({ force: true });
        await prisma.activity.create({
          data: {
            type: ActivityType.CONTAINER_DELETE,
            userId: session.user.id,
            description: `Removed container ${containerName}`,
            metadata: {
              containerId,
              containerName,
              status: containerInfo.State
            }
          }
        });
        break;

      default:
        throw new Error('Invalid action');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Container action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform container action' },
      { status: 500 }
    );
  }
}