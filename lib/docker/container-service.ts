import { getDockerClient } from './client';
import type { Container, ContainerStats, NetworkSettings } from './types';
import type { ContainerInfo } from 'dockerode';
import { prisma } from '@/lib/prisma';

interface CreateContainerConfig {
  name: string;
  image: string;
  userId: string;
  subdomain: string;
  ports?: { [key: string]: string };
  env?: { [key: string]: string };
  volumes?: { [key: string]: string };
}

export async function listContainers(): Promise<Container[]> {
  const docker = getDockerClient();
  try {
    const containers = await docker.listContainers({ all: true });
    const containerNames = containers.map(c => c.Names[0].replace(/^\//, ''));
    
    // Récupérer les informations supplémentaires de la base de données
    const dbContainers = await prisma.container.findMany({
      where: {
        name: {
          in: containerNames
        }
      }
    });

    // Créer une map pour un accès rapide aux données de la base
    const dbContainersMap = new Map(dbContainers.map(c => [c.name, c]));

    // Combiner les informations Docker avec celles de la base de données
    return containers.map(container => {
      const containerName = container.Names[0].replace(/^\//, '');
      const dbContainer = dbContainersMap.get(containerName);
      
      // Convertir NetworkSettings au format attendu
      const networkSettings: NetworkSettings = {
        Networks: container.NetworkSettings?.Networks || {},
        Ports: container.Ports?.reduce((acc, port) => {
          const key = `${port.PrivatePort}/${port.Type}`;
          acc[key] = port.PublicPort ? [{
            HostIp: port.IP || '0.0.0.0',
            HostPort: port.PublicPort.toString()
          }] : null;
          return acc;
        }, {} as NetworkSettings['Ports']) || {}
      };

      // Créer un nouvel objet avec les bons noms de champs
      const containerInfo = {
        Id: container.Id,
        Names: container.Names,
        Image: container.Image,
        ImageID: container.ImageID,
        Command: container.Command,
        Created: container.Created,
        State: container.State,
        Status: container.Status,
        Ports: container.Ports,
        Labels: container.Labels,
        Mounts: container.Mounts,
        NetworkSettings: networkSettings,
        created_at: dbContainer?.created.toISOString() || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: dbContainer?.userId || 'system'
      };

      return containerInfo as Container;
    });
  } catch (error) {
    console.error('Error listing containers:', error);
    throw new Error('Failed to list containers');
  }
}

export async function getContainerStats(containerId: string): Promise<ContainerStats> {
  const docker = getDockerClient();
  try {
    const container = docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });
    
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * 100;

    return {
      cpu: cpuPercent,
      memory: {
        usage: stats.memory_stats.usage,
        limit: stats.memory_stats.limit,
        percentage: (stats.memory_stats.usage / stats.memory_stats.limit) * 100,
      },
      network: {
        rx_bytes: Object.values(stats.networks || {}).reduce((acc: number, net: any) => acc + net.rx_bytes, 0),
        tx_bytes: Object.values(stats.networks || {}).reduce((acc: number, net: any) => acc + net.tx_bytes, 0),
      },
    };
  } catch (error) {
    console.error(`Error getting stats for container ${containerId}:`, error);
    throw new Error('Failed to get container stats');
  }
}

export async function createContainer(config: CreateContainerConfig): Promise<Container> {
  const docker = getDockerClient();
  try {
    // Valider le sous-domaine
    const subdomainRegex = /^[a-zA-Z0-9-]+$/;
    if (!subdomainRegex.test(config.subdomain)) {
      throw new Error('Invalid subdomain format');
    }

    // Configurer le réseau et les labels pour Traefik
    const labels = {
      'traefik.enable': 'true',
      [`traefik.http.routers.${config.name}.rule`]: `Host(\`${config.subdomain}.dockersphere.ovh\`)`,
      [`traefik.http.routers.${config.name}.entrypoints`]: 'websecure',
      [`traefik.http.routers.${config.name}.tls.certresolver`]: 'letsencrypt'
    };

    // Créer le conteneur
    const containerConfig = {
      Image: config.image,
      name: config.name,
      Labels: labels,
      ExposedPorts: {},
      HostConfig: {
        PortBindings: {},
        RestartPolicy: {
          Name: 'unless-stopped'
        }
      },
      Env: Object.entries(config.env || {}).map(([key, value]) => `${key}=${value}`)
    };

    // Créer le conteneur avec Docker
    const container = await docker.createContainer(containerConfig);
    
    // Enregistrer le conteneur dans la base de données
    const dbContainer = await prisma.container.create({
      data: {
        name: config.name,
        imageId: config.image,
        status: 'created',
        userId: config.userId,
        subdomain: config.subdomain,
        ports: config.ports || {},
        volumes: config.volumes || {},
        env: config.env || {},
        cpuLimit: 0,
        memoryLimit: 0
      }
    });

    // Démarrer le conteneur
    await container.start();

    // Retourner les informations du conteneur
    const containerInfo = await container.inspect();
    const containerData: Container = {
      Id: containerInfo.Id,
      Names: [containerInfo.Name],
      Image: containerInfo.Config.Image,
      ImageID: containerInfo.Image,
      Command: containerInfo.Config.Cmd?.join(' ') || '',
      Created: parseInt(containerInfo.Created),
      Ports: Object.entries(containerInfo.NetworkSettings.Ports || {}).map(([key, value]) => {
        const [port, protocol] = key.split('/');
        return {
          PrivatePort: parseInt(port),
          PublicPort: value?.[0]?.HostPort ? parseInt(value[0].HostPort) : 0,
          Type: protocol || 'tcp',
          IP: value?.[0]?.HostIp || '0.0.0.0'
        };
      }),
      State: containerInfo.State.Status,
      Status: containerInfo.State.Status,
      Labels: containerInfo.Config.Labels || {},
      HostConfig: {
        NetworkMode: containerInfo.HostConfig.NetworkMode || 'default'
      },
      NetworkSettings: {
        Networks: containerInfo.NetworkSettings.Networks,
        Ports: containerInfo.NetworkSettings.Ports
      },
      Mounts: containerInfo.Mounts.map(mount => ({
        Name: mount.Name,
        Source: mount.Source,
        Destination: mount.Destination,
        Mode: mount.Mode,
        RW: mount.RW,
        Propagation: mount.Propagation,
        Type: 'volume'  // Default to volume type
      })),
      created_at: dbContainer.created.toISOString(),
      updated_at: new Date().toISOString(),
      user_id: dbContainer.userId,
      subdomain: config.subdomain
    };
    return containerData;
  } catch (error) {
    console.error('Error creating container:', error);
    throw new Error(`Failed to create container: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}