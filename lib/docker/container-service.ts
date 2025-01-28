import Docker from 'dockerode';
import { Container, ContainerInspectInfo, DockerStats, Mount, RestartPolicy, DockerContainer, DockerMount } from './types';
import { prisma } from '@/lib/prisma';

const docker = new Docker();

/**
 * Récupère les informations détaillées d'un conteneur
 */
export async function getContainer(userId: string, containerId: string): Promise<ContainerInspectInfo> {
  try {
    // Vérifier que l'utilisateur a accès au conteneur
    const userContainer = await prisma.container.findFirst({
      where: {
        userId,
        id: containerId,
      },
    });

    if (!userContainer) {
      throw new Error('Container not found or access denied');
    }

    const container = docker.getContainer(containerId);
    const containerInfo = await container.inspect() as any;

    // Mapper les données pour correspondre à l'interface ContainerInspectInfo
    const mappedInfo: ContainerInspectInfo = {
      Id: containerInfo.Id,
      Names: [containerInfo.Name],
      Image: containerInfo.Config.Image,
      ImageID: containerInfo.Image,
      Command: containerInfo.Config.Cmd?.join(' ') || '',
      Created: new Date(containerInfo.Created).getTime(),
      Status: containerInfo.State.Status,
      Ports: [], // À remplir si nécessaire
      Labels: containerInfo.Config.Labels || {},
      NetworkSettings: containerInfo.NetworkSettings,
      Mounts: (containerInfo.Mounts as DockerMount[]).map((mount): Mount => ({
        Type: mount.Type || 'bind',
        Source: mount.Source,
        Destination: mount.Destination,
        Mode: mount.Mode || 'rw',
        RW: mount.RW,
        Propagation: mount.Propagation || 'rprivate',
        Name: mount.Name,
        Driver: mount.Driver,
      })),
      HostConfig: {
        NetworkMode: containerInfo.HostConfig.NetworkMode || 'default',
        RestartPolicy: {
          Name: containerInfo.HostConfig.RestartPolicy?.Name || 'no',
          MaximumRetryCount: containerInfo.HostConfig.RestartPolicy?.MaximumRetryCount || 0,
        },
      },
      State: containerInfo.State,
      Config: {
        ...containerInfo.Config,
        Entrypoint: Array.isArray(containerInfo.Config.Entrypoint)
          ? containerInfo.Config.Entrypoint
          : containerInfo.Config.Entrypoint
          ? [containerInfo.Config.Entrypoint]
          : null,
      },
      subdomain: userContainer.subdomain,
      created_at: userContainer.created.toISOString(),
      user_id: userContainer.userId,
    };

    return mappedInfo;
  } catch (error) {
    console.error('Error getting container:', error);
    throw error;
  }
}

/**
 * Récupère les statistiques d'un conteneur
 */
export async function getContainerStats(
  userId: string,
  containerId: string
): Promise<DockerStats> {
  try {
    // Vérifier que l'utilisateur a accès au conteneur
    const userContainer = await prisma.container.findFirst({
      where: {
        userId,
        id: containerId,
      },
    });

    if (!userContainer) {
      throw new Error('Container not found or access denied');
    }

    const container = docker.getContainer(containerId);
    const stats = await container.stats({ stream: false }) as any;

    // Formater les statistiques pour correspondre à l'interface DockerStats
    const dockerStats: DockerStats = {
      read: stats.read,
      preread: stats.preread,
      pids_stats: {
        current: stats.pids_stats?.current || 0,
      },
      blkio_stats: stats.blkio_stats || {
        io_service_bytes_recursive: [],
      },
      num_procs: stats.num_procs || 0,
      storage_stats: stats.storage_stats || {},
      cpu_stats: stats.cpu_stats,
      precpu_stats: stats.precpu_stats,
      memory_stats: stats.memory_stats,
      name: userContainer.name,
      id: containerId,
      networks: stats.networks,
    };

    return dockerStats;
  } catch (error) {
    console.error('Error getting container stats:', error);
    throw error;
  }
}

/**
 * Récupère les logs d'un conteneur
 */
export async function getContainerLogs(
  userId: string,
  containerId: string,
  options: { tail?: number; since?: number; timestamps?: boolean } = {}
): Promise<string[]> {
  try {
    // Vérifier que l'utilisateur a accès au conteneur
    const userContainer = await prisma.container.findFirst({
      where: {
        userId,
        id: containerId,
      },
    });

    if (!userContainer) {
      throw new Error('Container not found or access denied');
    }

    const container = docker.getContainer(containerId);
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail: options.tail || 100,
      since: options.since || 0,
      timestamps: options.timestamps || false,
    });

    // Convertir le stream en tableau de lignes
    const chunks: Buffer[] = [];
    for await (const chunk of logStream) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      }
    }

    const buffer = Buffer.concat(chunks);
    const output = buffer.toString('utf8');

    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error('Error getting container logs:', error);
    throw error;
  }
}

/**
 * Liste tous les conteneurs d'un utilisateur
 */
export async function listContainers(userId: string): Promise<Container[]> {
  const containers = await docker.listContainers({ all: true }) as DockerContainer[];
  const userContainers = await prisma.container.findMany({
    where: { userId },
  });

  return containers
    .filter(container => {
      const containerName = container.Names[0]?.replace('/', '');
      return userContainers.some(uc => uc.name === containerName);
    })
    .map(container => {
      const userContainer = userContainers.find(
        uc => uc.name === container.Names[0]?.replace('/', '')
      );

      if (!userContainer) {
        throw new Error('Container not found in database');
      }

      const mappedContainer: Container = {
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
        NetworkSettings: container.NetworkSettings,
        Mounts: container.Mounts.map((mount): Mount => ({
          Type: mount.Type,
          Source: mount.Source,
          Destination: mount.Destination,
          Mode: mount.Mode || 'rw',
          RW: mount.RW,
          Propagation: mount.Propagation || 'rprivate',
          Name: mount.Name,
          Driver: mount.Driver,
        })),
        HostConfig: {
          NetworkMode: container.HostConfig.NetworkMode || 'default',
          RestartPolicy: {
            Name: container.HostConfig.RestartPolicy?.Name || 'no',
            MaximumRetryCount: container.HostConfig.RestartPolicy?.MaximumRetryCount || 0,
          },
        },
        subdomain: userContainer.subdomain,
        created_at: userContainer.created.toISOString(),
        user_id: userId,
      };

      return mappedContainer;
    });
}

/**
 * Interface pour la création d'un conteneur
 */
export interface CreateContainerConfig {
  name: string;
  image: string;
  userId: string;
  ports?: { [key: string]: number };
  volumes?: { [key: string]: string };
  env?: { [key: string]: string };
}