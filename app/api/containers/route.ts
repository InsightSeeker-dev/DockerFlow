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
import Docker, { ContainerCreateOptions, ContainerInfo } from 'dockerode';
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
  name: z.string().min(1).regex(/^[a-zA-Z0-9-]+$/, 'Container name must contain only letters, numbers, and hyphens'),
  image: z.string(),
  subdomain: z.string().min(3).max(63).regex(/^[a-zA-Z0-9-]+$/, 'Subdomain must contain only letters, numbers, and hyphens'),
  volumes: z.array(z.object({
    volumeId: z.string(),
    mountPath: z.string()
  })).optional(),
});

type CreateContainerRequest = z.infer<typeof createContainerSchema>;

// Fonction utilitaire pour déterminer le port par défaut selon l'image
const getDefaultPort = (image: string): number => {
  if (image.includes('grafana')) return 3000;
  if (image.includes('mongo')) return 27017;
  if (image.includes('mysql')) return 3306;
  if (image.includes('postgres')) return 5432;
  if (image.includes('redis')) return 6379;
  return 80; // Port par défaut pour les autres images
};

const containerActionSchema = z.object({
  action: z.enum(['start', 'stop', 'remove']),
  containerId: z.string(),
  keepVolume: z.boolean().optional()
});

function generateTraefikLabels(name: string, subdomain: string, port: number): Record<string, string> {
  return {
    'traefik.enable': 'true',
    // Router configuration
    [`traefik.http.routers.${name}.rule`]: `Host(\`${subdomain}.dockersphere.ovh\`)`,
    [`traefik.http.routers.${name}.entrypoints`]: 'websecure',
    [`traefik.http.routers.${name}.tls`]: 'true',
    [`traefik.http.routers.${name}.tls.certresolver`]: 'letsencrypt',
    [`traefik.http.routers.${name}.service`]: `${name}`,
    [`traefik.http.services.${name}.loadbalancer.server.port`]: `${port}`,
    [`traefik.http.routers.${name}.tls.domains[0].main`]: 'dockersphere.ovh',
    [`traefik.http.routers.${name}.tls.domains[0].sans`]: '*.dockersphere.ovh',
    
    // Service configuration
    [`traefik.http.services.${name}.loadbalancer.server.port`]: port.toString(),
    [`traefik.http.services.${name}.loadbalancer.passHostHeader`]: 'true',
    
    // Utilisation des middlewares globaux depuis traefik_dynamic.yml
    [`traefik.http.routers.${name}.middlewares`]: 'secure-headers@file,rate-limit@file',
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Session user:', {
      id: session.user.id,
      role: session.user.role,
      email: session.user.email
    });

    // Récupérer uniquement les conteneurs de la base de données
    console.log('Fetching DB containers...');
    const dbContainers = await prisma.container.findMany({
      select: {
        id: true,
        name: true,
        imageId: true,
        status: true,
        ports: true,
        volumes: true,
        env: true,
        cpuLimit: true,
        memoryLimit: true,
        subdomain: true,
        created: true,
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
    console.log('DB containers found:', dbContainers.length);

    // Récupérer les informations des images depuis Docker
    const docker = await getDockerClient();
    const images = await docker.listImages();

    // Transformer les conteneurs pour le format attendu par le front-end
    const containers = dbContainers.map(container => {
      // Trouver l'image correspondante
      const dockerImage = images.find(img => img.Id === container.imageId);
      const imageName = dockerImage?.RepoTags?.[0] || container.imageId;

      return ({
      Id: container.id,
      dockerId: container.id, // L'ID de la base de données est aussi l'ID Docker
      Names: [`/${container.name}`],
      Image: imageName,
      ImageID: container.imageId,
      Command: '',
      Created: container.created.getTime() / 1000,
      State: container.status,
      Status: container.status,
      Ports: container.ports as any[] || [],
      Labels: {},
      customConfig: {
        subdomain: container.subdomain,
        ports: container.ports,
        volumes: container.volumes 
          ? Object.fromEntries(
              (container.volumes as any[]).map(vol => [vol.name, vol.path])
            )
          : {},
        env: container.env || {},
        cpuLimit: container.cpuLimit,
        memoryLimit: container.memoryLimit,
      },
      user: container.user,
      traefik: {
        enabled: true,
        rule: `Host(\`${container.subdomain}.dockersphere.ovh\`)`,
        tls: true,
        certresolver: 'letsencrypt'
      }
    });
  });

    console.log(`Returning ${containers.length} containers`);
    return NextResponse.json(containers);

  } catch (error) {
    console.error('Error in GET /api/containers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch containers' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  console.log('Début de la requête POST /api/containers');
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    console.log('Session utilisateur:', session?.user);
    
    if (!session?.user?.id) {
      console.log('Utilisateur non authentifié');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    console.log('Données reçues:', body);
    
    const validatedData = createContainerSchema.parse(body);
    const { name, image: imageName, subdomain, volumes } = validatedData;
    console.log('Données validées:', { name, imageName, subdomain, volumes });

    console.log('Creating container with:', { name, imageName, subdomain, volumes });

    // Vérifier si le conteneur existe déjà
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
        { error: 'Container with this name or subdomain already exists' },
        { status: 400 }
      );
    }

    // Vérifier les volumes si spécifiés
    if (volumes && volumes.length > 0) {
      const volumeIds = volumes.map(v => v.volumeId);
      const existingVolumes = await prisma.volume.findMany({
        where: {
          AND: [
            { id: { in: volumeIds } },
            { userId: session.user.id }
          ]
        }
      });

      if (existingVolumes.length !== volumeIds.length) {
        return NextResponse.json(
          { error: 'One or more volumes not found or unauthorized' },
          { status: 400 }
        );
      }

      // Vérifier les points de montage uniques
      const mountPaths = volumes.map(v => v.mountPath);
      if (new Set(mountPaths).size !== mountPaths.length) {
        return NextResponse.json(
          { error: 'Duplicate mount paths are not allowed' },
          { status: 400 }
        );
      }
    }

    // Déterminer le port par défaut selon l'image et configurer les ports
    const containerPort = getDefaultPort(imageName);
    console.log(`Port par défaut pour ${imageName}: ${containerPort}`);

    // Trouver un port disponible pour le container
    let hostPort: number;
    try {
      hostPort = await suggestAlternativePort(8080);
      console.log(`Port hôte attribué: ${hostPort}`);
    } catch (error: any) {
      console.error('Error finding available port:', error);
      return NextResponse.json(
        { error: 'No available ports found' },
        { status: 500 }
      );
    }

    // Préparer la configuration des ports pour Docker
    const portConfig = {
      exposedPorts: { [`${containerPort}/tcp`]: {} },
      portBindings: { [`${containerPort}/tcp`]: [{ HostPort: hostPort.toString() }] }
    };

    // Configuration des ports pour la base de données
    const dbPorts = [
      {
        containerPort: containerPort,
        hostPort: hostPort,
        protocol: 'tcp'
      }
    ];

    // Traiter les volumes
    let volumeBinds: string[] = [];
    if (volumes && volumes.length > 0) {
      const volumeInfos = await prisma.volume.findMany({
        where: {
          id: { in: volumes.map(v => v.volumeId) }
        }
      });

      volumeBinds = volumes.map(vol => {
        const volumeInfo = volumeInfos.find(v => v.id === vol.volumeId);
        if (!volumeInfo) {
          throw new Error(`Volume ${vol.volumeId} not found`);
        }
        return `${volumeInfo.name}:${vol.mountPath}`;
      });
    }

    console.log('Volume binds:', volumeBinds);

    console.log('Initialisation du client Docker');
    const docker = await getDockerClient();
    console.log('Client Docker initialisé');

    // Vérifier si l'image existe localement et récupérer son ID
    let imageId: string;
    try {
      const images = await docker.listImages();
      const image = images.find(img => 
        img.RepoTags && img.RepoTags.includes(imageName)
      );
      
      if (!image) {
        console.error(`Image ${imageName} not found locally`);
        return NextResponse.json(
          { error: `Image ${imageName} not found locally. Please use an available image.` },
          { status: 400 }
        );
      }
      
      imageId = image.Id;
    } catch (error: any) {
      console.error('Error checking image:', error);
      const errorMessage = error?.message || 'Unknown error occurred while checking image';
      return NextResponse.json(
        { error: `Failed to check image: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Vérifier que le réseau proxy existe
    try {
      const networks = await docker.listNetworks();
      const proxyNetwork = networks.find(n => n.Name === 'proxy');
      if (!proxyNetwork) {
        throw new Error('Proxy network not found');
      }
    } catch (error: any) {
      console.error('Error checking proxy network:', error);
      return NextResponse.json(
        { error: 'Failed to verify network configuration' },
        { status: 500 }
      );
    }

    const containerConfig: ContainerCreateOptions = {
      Image: imageName,
      name,
      ExposedPorts: portConfig.exposedPorts,
      HostConfig: {
        PortBindings: portConfig.portBindings,
        Binds: volumeBinds,
        NetworkMode: 'proxy',
        RestartPolicy: {
          Name: 'unless-stopped'
        },
        Memory: session.user.memoryLimit || 8589934592, // 8GB default
        NanoCpus: (session.user.cpuLimit || 4000) * 1000000, // 4 cores default
        Dns: ['1.1.1.1', '8.8.8.8']
      },
      Labels: {
        ...generateTraefikLabels(name, subdomain, containerPort),
        'traefik.enable': 'true',
        'traefik.docker.network': 'proxy',
        [`traefik.http.services.${name}.loadbalancer.server.port`]: containerPort.toString(),
        'com.docker.compose.project': 'dockerflow',
        'com.docker.compose.service': name,
        'com.dockerflow.subdomain': subdomain
      },
      Env: [
        `VIRTUAL_HOST=${subdomain}.dockersphere.ovh`,
        `DOMAIN=${subdomain}.dockersphere.ovh`,
        'DOCKER_HOST=unix:///var/run/docker.sock'
      ]
    };

    console.log('Creating container with config:', JSON.stringify(containerConfig, null, 2));

    // Créer le conteneur Docker avec gestion des erreurs
    let container;
    try {
      container = await docker.createContainer(containerConfig);
      console.log('Container created:', container.id);

      // Démarrer le conteneur
      await container.start();
      console.log('Container started');

      // Vérifier que le conteneur est bien démarré
      const containerInfo = await container.inspect();
      if (!containerInfo.State.Running) {
        throw new Error('Container failed to start');
      }
    } catch (error: any) {
      console.error('Error creating/starting container:', error);
      
      // Si le conteneur a été créé mais n'a pas démarré, on le supprime
      if (container) {
        try {
          await container.remove({ force: true });
          console.log('Failed container removed');
        } catch (removeError: any) {
          console.error('Error removing failed container:', removeError);
        }
      }

      const errorMessage = error?.message || 'Unknown error occurred while creating/starting container';
      return NextResponse.json(
        { error: `Failed to create/start container: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Sauvegarder dans la base de données
    const dbContainer = await prisma.container.create({
      data: {
        name,
        subdomain,
        status: 'running',
        userId: session.user.id,
        imageId: imageId,
        image: imageName,
        ports: dbPorts,
        url: `https://${subdomain}.dockersphere.ovh`,
        cpuLimit: session.user.cpuLimit || 4000,
        memoryLimit: session.user.memoryLimit || 8589934592,
        containerVolumes: volumes ? {
          create: volumes.map(vol => ({
            volumeId: vol.volumeId,
            mountPath: vol.mountPath
          }))
        } : undefined
      },
      include: {
        containerVolumes: {
          include: {
            volume: true
          }
        },
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Créer une activité
    await prisma.activity.create({
      data: {
        type: ActivityType.CONTAINER_CREATE,
        description: `Container ${name} created`,
        userId: session.user.id,
        metadata: {
          containerId: dbContainer.id,
          containerName: name,
          image: imageName,
          volumes: volumes ? volumes.map(v => ({
            volumeId: v.volumeId,
            mountPath: v.mountPath
          })) : []
        } as Prisma.JsonValue
      }
    });

    console.log('Conteneur créé avec succès:', dbContainer);
    return NextResponse.json(dbContainer);
  } catch (error) {
    console.error('Erreur lors de la création du conteneur:', error);
    if (error instanceof z.ZodError) {
      console.log('Erreur de validation:', error.errors);
      return NextResponse.json(
        { error: 'Données du conteneur invalides', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create container' },
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
    const { action, containerId, keepVolume } = validatedData;

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

        // Supprimer le conteneur
        await container.remove({ force: true });

        // Si keepVolume n'est pas true, supprimer les volumes associés
        if (!keepVolume && containerInspectInfo.Mounts) {
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
            description: `Removed container ${containerName}${keepVolume ? ' (volume preserved)' : ' and associated volumes'}`,
            metadata: {
              containerId,
              containerName,
              status: containerInfo.State,
              volumesPreserved: keepVolume
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