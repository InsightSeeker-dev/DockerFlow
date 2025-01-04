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
import { containerActivity } from '@/lib/activity';
import { ovhDNSService } from '@/lib/ovh/dns-service';

export const dynamic = 'force-dynamic';

interface ExtendedSession extends Session {
  user: {
    id: string;
    email: string;
    role: string;
  } & Session['user']
}

const createContainerSchema = z.object({
  name: z.string().min(1).max(63).regex(/^[a-zA-Z0-9-]+$/, 'Container name must contain only letters, numbers, and hyphens'),
  image: z.string(),
  subdomain: z.string().min(3).max(63).regex(/^[a-zA-Z0-9-]+$/, 'Subdomain must contain only letters, numbers, and hyphens'),
  port: z.number().min(1),
  enableHttps: z.boolean().default(true),
  labels: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  volumes: z.record(z.string()).optional(),
  cpuLimit: z.number().optional(),
  memoryLimit: z.number().optional(),
});

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
    const containers = await docker.listContainers({ all: true });
    
    // Get user's containers from database
    const userContainers = await prisma.container.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    
    const userContainerIds = new Set(userContainers.map((container: { id: any; }) => container.id));
    
    // Filter Docker containers to only show user's containers
    const filteredContainers = containers.filter(container => userContainerIds.has(container.Id));
    
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

    const { name, image: imageName, subdomain, port, enableHttps, labels, env, volumes, cpuLimit, memoryLimit } = result.data;

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

    // Vérifier la limite de stockage avant de créer le conteneur
    const imageSize = await getImageSize(imageName);
    const hasSpace = await checkStorageLimit(session.user.id, imageSize);
    
    if (!hasSpace) {
      return NextResponse.json(
        { error: 'Storage limit exceeded. Please remove some containers or images to free up space.' },
        { status: 400 }
      );
    }

    // S'assurer que l'image est disponible
    const image = imageName.includes(':') ? imageName : `${imageName}:latest`;
    await pullImage(image, session.user.id);

    // Créer le sous-domaine DNS chez OVH
    try {
      await ovhDNSService.addSubdomain(subdomain);
    } catch (error) {
      console.error('Erreur lors de la création du sous-domaine:', error);
      return NextResponse.json(
        { error: 'Failed to create subdomain. Please try again.' },
        { status: 500 }
      );
    }

    // Créer le conteneur avec la configuration Traefik
    const docker = getDockerClient();
    const containerConfig = {
      Image: image,
      name,
      Labels: {
        ...labels,
        'traefik.enable': 'true',
        [`traefik.http.routers.${name}.rule`]: `Host(\`${subdomain}.dockersphere.ovh\`)`,
        [`traefik.http.routers.${name}.entrypoints`]: enableHttps ? 'websecure' : 'web',
        [`traefik.http.routers.${name}.tls.certresolver`]: enableHttps ? 'letsencrypt' : '',
      },
      ExposedPorts: {
        [`${port}/tcp`]: {}
      },
      HostConfig: {
        PortBindings: {
          [`${port}/tcp`]: [{ HostPort: '0' }]
        },
        Binds: volumes ? Object.entries(volumes).map(([host, container]) => `${host}:${container}`) : [],
        RestartPolicy: {
          Name: 'unless-stopped'
        }
      },
      Env: [
        ...Object.entries(env || {}).map(([key, value]) => `${key}=${value}`),
        `VIRTUAL_HOST=${subdomain}.dockersphere.ovh`,
        enableHttps ? `LETSENCRYPT_HOST=${subdomain}.dockersphere.ovh` : ''
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
        subdomain,
        ports: { [port]: port },
        volumes: volumes || {},
        env: {
          ...(env || {}),
          VIRTUAL_HOST: `${subdomain}.dockersphere.ovh`,
          LETSENCRYPT_HOST: enableHttps ? `${subdomain}.dockersphere.ovh` : ''
        },
        cpuLimit: cpuLimit || 0,
        memoryLimit: memoryLimit || 0
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
      container: {
        id: container.id,
        name,
        subdomain: `${subdomain}.dockersphere.ovh`,
        status: 'running'
      }
    });
  } catch (error) {
    console.error('Error creating container:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create container';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
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