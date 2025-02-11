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
    cpuLimit?: number;
    memoryLimit?: number;
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
  RestartPolicy?: {
    Name: string;
  }
}

interface CustomConfig {
  subdomain: string;
  ports: any;
  volumes: any;
  env: any;
  cpuLimit: number;
  memoryLimit: number;
}

interface ExtendedConfig {
  subdomain?: string;
  ports?: any;
  volumes?: any;
  env?: any;
}

interface ExtendedContainerInfo extends Omit<ContainerInfo, 'HostConfig'> {
  HostConfig?: ExtendedHostConfig;
  customConfig?: CustomConfig;
}

interface Mount {
  Type?: string;
  Name?: string;
  Source: string;
  Destination: string;
  Driver?: string;
  Mode: string;
  RW: boolean;
  Propagation: string;
}

const createContainerSchema = z.object({
  name: z.string(),
  image: z.string(),
  subdomain: z.string().min(3).max(63).regex(/^[a-zA-Z0-9-]+$/, 'Subdomain must contain only letters, numbers, and hyphens'),
});

type CreateContainerRequest = z.infer<typeof createContainerSchema>;

const containerActionSchema = z.object({
  action: z.enum(['start', 'stop', 'remove']),
  containerId: z.string(),
});

function generateTraefikLabels(name: string, port: number): Record<string, string> {
  const subdomain = name.toLowerCase();
  return {
    'traefik.enable': 'true',
    // Router configuration
    [`traefik.http.routers.${name}.rule`]: `Host(\`${subdomain}.dockersphere.ovh\`)`,
    [`traefik.http.routers.${name}.entrypoints`]: 'websecure',
    [`traefik.http.routers.${name}.tls`]: 'true',
    [`traefik.http.routers.${name}.tls.certresolver`]: 'letsencrypt',
    [`traefik.http.routers.${name}.tls.domains[0].main`]: 'dockersphere.ovh',
    [`traefik.http.routers.${name}.tls.domains[0].sans`]: '*.dockersphere.ovh',
    
    // Service configuration
    [`traefik.http.services.${name}.loadbalancer.server.port`]: port.toString(),
    [`traefik.http.services.${name}.loadbalancer.passHostHeader`]: 'true',
    
    // Utilisation des middlewares globaux depuis traefik_dynamic.yml
    [`traefik.http.routers.${name}.middlewares`]: 'secure-headers@file',
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    
    if (!session?.user?.id) {
      console.log('No session or user ID found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Fetching containers for user:', session.user.id);

    // Déterminer si l'utilisateur est admin
    const isAdmin = session.user.role === 'ADMIN';

    // 1. Récupérer les conteneurs selon le rôle
    const userContainers = await prisma.container.findMany({
      where: isAdmin ? {} : { userId: session.user.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    // 2. Récupérer les conteneurs Docker
    const docker = getDockerClient();
    const dockerContainers = await docker.listContainers({ all: true });

    // 3. Fusionner les informations
    const enrichedContainers = dockerContainers.map(dockerContainer => {
      const dbContainer = userContainers.find(
        db => db.name === dockerContainer.Names[0].replace(/^\//, '')
      );

      if (!dbContainer) return null;

      return {
        ...dockerContainer,
        customConfig: {
          subdomain: dbContainer.subdomain,
          ports: dbContainer.ports,
          volumes: dbContainer.volumes,
          env: dbContainer.env,
          cpuLimit: dbContainer.cpuLimit,
          memoryLimit: dbContainer.memoryLimit,
        },
        user: dbContainer.user,
        traefik: {
          enabled: true,
          rule: `Host(\`${dbContainer.subdomain}.dockersphere.ovh\`)`,
          tls: true,
          certresolver: 'letsencrypt'
        }
      };
    }).filter(Boolean);

    return NextResponse.json(enrichedContainers);
  } catch (error) {
    console.error('Error fetching containers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch containers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log('Starting container creation process...');
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      console.error('No session found, unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('User authenticated:', session.user.id);

    const body = await request.json();
    console.log('Received request body:', JSON.stringify(body, null, 2));
    
    const result = createContainerSchema.safeParse(body);
    if (!result.success) {
      console.error('Validation failed:', JSON.stringify(result.error.issues, null, 2));
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.issues },
        { status: 400 }
      );
    }

    const { name, image: imageName, subdomain } = result.data;
    console.log('Validated data:', { name, imageName, subdomain });

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
      console.error('Container name or subdomain already exists:', existingContainer);
      return NextResponse.json(
        { error: 'Container name or subdomain already in use' },
        { status: 400 }
      );
    }
    console.log('No existing container found with same name/subdomain');

    const docker = getDockerClient();
    console.log('Docker client initialized');

    // Inspecter l'image pour obtenir les ports exposés
    console.log('Getting image info for:', imageName);
    const image = await docker.getImage(imageName);
    console.log('Got image reference');
    const imageInfo = await image.inspect();
    console.log('Image inspection completed');
    
    // Vérifier les ports exposés dans Config ET ContainerConfig
    const configPorts = imageInfo.Config.ExposedPorts || {};
    const containerConfigPorts = imageInfo.ContainerConfig?.ExposedPorts || {};
    const exposedPorts = { ...configPorts, ...containerConfigPorts };
    
    console.log('Detected exposed ports:', JSON.stringify(exposedPorts, null, 2));

    // Créer un volume unique pour ce conteneur
    const volumeName = `${name}-data`;
    console.log('Creating volume:', volumeName);
    await docker.createVolume({
      Name: volumeName,
      Driver: 'local'
    });
    console.log('Volume created successfully');

    // Constants pour la gestion des ports
    const DEFAULT_PORT_RANGE_START = 3000;  // Port de départ pour les conteneurs sans ports exposés
    const DEFAULT_PORT_RANGE_END = 4000;    // Port de fin pour la plage par défaut

    // Mapper les ports exposés à des ports hôtes disponibles
    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
    const exposedPortsList: Array<{ containerPort: number, hostPort: number }> = [];
    const containerExposedPorts: Record<string, {}> = {};
    
    console.log('Starting port mapping process...');
    for (const port in exposedPorts) {
      const containerPort = parseInt(port.split('/')[0]);
      console.log(`Finding available host port for container port ${containerPort}...`);
      const hostPort = await suggestAlternativePort(containerPort);
      console.log(`Selected host port ${hostPort} for container port ${containerPort}`);
      const portKey = `${containerPort}/tcp`;
      
      portBindings[portKey] = [{ HostPort: hostPort.toString() }];
      containerExposedPorts[portKey] = {};
      exposedPortsList.push({ containerPort, hostPort });
    }

    // Si aucun port n'est exposé, utiliser un port dans la plage par défaut
    if (Object.keys(exposedPorts).length === 0) {
      const defaultContainerPort = DEFAULT_PORT_RANGE_START;
      console.log(`No exposed ports, finding available port starting from ${DEFAULT_PORT_RANGE_START}...`);
      const hostPort = await suggestAlternativePort(DEFAULT_PORT_RANGE_START);
      console.log(`Selected default host port: ${hostPort}`);
      const portKey = `${defaultContainerPort}/tcp`;
      
      portBindings[portKey] = [{ HostPort: hostPort.toString() }];
      containerExposedPorts[portKey] = {};
      exposedPortsList.push({ 
        containerPort: defaultContainerPort, 
        hostPort 
      });
    }

    // Préparer la configuration du conteneur
    const containerConfig = {
      Image: imageName,
      name,
      ExposedPorts: containerExposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        Binds: [`${volumeName}:/data`],
        NetworkMode: 'proxy',
        RestartPolicy: {
          Name: 'unless-stopped'
        }
      },
      Labels: {
        ...generateTraefikLabels(name, exposedPortsList[0].containerPort),
      }
    };

    // Créer et démarrer le conteneur
    console.log('Creating Docker container with config:', JSON.stringify(containerConfig, null, 2));
    const container = await docker.createContainer(containerConfig);
    console.log('Docker container created with ID:', container.id);
    
    await container.start();
    console.log('Docker container started');

    // Enregistrer le conteneur dans la base de données
    console.log('Saving container to database...');
    const dbContainer = await prisma.container.create({
      data: {
        name,
        imageId: imageName,
        subdomain,
        userId: session.user.id,
        status: 'running',
        ports: exposedPortsList as Prisma.JsonValue,
        volumes: [{
          name: volumeName,
          mountPath: '/data'
        }] as Prisma.JsonValue,
        cpuLimit: session.user.cpuLimit || 4000,
        memoryLimit: session.user.memoryLimit || 8589934592
      }
    });
    console.log('Container saved to database:', dbContainer);

    // Enregistrer l'activité
    console.log('Recording activity...');
    await prisma.activity.create({
      data: {
        type: ActivityType.CONTAINER_CREATE,
        userId: session.user.id,
        description: `Created container ${name} with automatic port mapping`,
        metadata: {
          containerId: container.id,
          containerName: name,
          image: imageName,
          ports: exposedPortsList
        } as Prisma.JsonValue
      }
    });

    return NextResponse.json({ 
      id: dbContainer.id,
      name: dbContainer.name,
      subdomain: dbContainer.subdomain,
      ports: exposedPortsList
    });
  } catch (error: any) {
    console.error('Error creating container:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create container' },
      { status: 500 }
    );
  }
}

async function findAvailablePort(startPort: number, preferredEndPort?: number): Promise<number> {
  const docker = getDockerClient();
  const containers = await docker.listContainers({ all: true });
  const usedPorts = new Set<number>();
  
  // Collecter tous les ports utilisés
  containers.forEach(container => {
    container.Ports?.forEach(port => {
      if (port.PublicPort) {
        usedPorts.add(port.PublicPort);
      }
    });
  });

  // D'abord, essayer dans la plage préférée
  let port = startPort;
  const maxPreferredPort = preferredEndPort || 65535;

  while (port <= maxPreferredPort) {
    if (!usedPorts.has(port)) {
      console.log(`Found available port ${port} within preferred range ${startPort}-${maxPreferredPort}`);
      return port;
    }
    port++;
  }

  // Si aucun port n'est disponible dans la plage préférée, continuer après la plage
  console.log(`No ports available in preferred range ${startPort}-${maxPreferredPort}, searching beyond...`);
  port = maxPreferredPort + 1;
  
  while (port <= 65535) {
    if (!usedPorts.has(port)) {
      console.log(`Found available port ${port} outside preferred range`);
      return port;
    }
    port++;
  }

  throw new Error('No available ports found in entire valid port range (1-65535)');
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
        // Récupérer les informations détaillées du conteneur
        const containerInspectInfo = await container.inspect();

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

        // Supprimer le conteneur avec l'option v pour supprimer les volumes anonymes
        await container.remove({ 
          force: true,
          v: true
        });

        // Supprimer les volumes nommés associés
        if (containerInspectInfo.Mounts) {
          const docker = getDockerClient();
          for (const mount of containerInspectInfo.Mounts as Mount[]) {
            if (mount.Type === 'volume' && mount.Name) {
              try {
                const volume = docker.getVolume(mount.Name);
                await volume.remove();
                console.log(`Volume ${mount.Name} supprimé avec succès`);
              } catch (error) {
                console.error(`Erreur lors de la suppression du volume ${mount.Name}:`, error);
              }
            }
          }
        }

        await prisma.activity.create({
          data: {
            type: ActivityType.CONTAINER_DELETE,
            userId: session.user.id,
            description: `Removed container ${containerName} and associated volumes`,
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