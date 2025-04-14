import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/lib/session';
import { getDockerClient } from '@/lib/docker';
import { dockerVolumeSync } from '@/lib/docker/volumeSync';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { ActivityType, Prisma } from '@prisma/client';
import { getUserStorageUsage } from '@/lib/docker/storage';
import { DockerError } from '@/lib/docker/errors';
import { logger } from '@/lib/logger';

const createVolumeSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9-]+$/, 'Volume name must contain only letters, numbers, and hyphens'),
  driver: z.string().optional().default('local'),
});

export async function GET(request: Request) {
  try {
    // Amélioration de la gestion de session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logger.warn('Unauthorized access attempt to volumes API');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    logger.info(`Fetching volumes for user ${userId}`);
    logger.info('Current session user:', { 
      id: userId,
      email: session.user.email,
      name: session.user.name 
    });

    // 1. Récupérer les volumes Docker et les conteneurs
    try {
      const docker = await getDockerClient();
      const [volumesResponse, containers] = await Promise.all([
        docker.listVolumes(),
        docker.listContainers({ all: true })
      ]);

      const dockerVolumes = (volumesResponse.Volumes || []).filter(vol => {
        // Un volume doit avoir les labels requis ET correspondre à l'utilisateur actuel
        // OU être un volume géré par DockerFlow (avec le préfixe dockerflow_)
        const hasRequiredLabels = vol.Labels && 
          vol.Labels['com.dockerflow.managed'] === 'true' && 
          vol.Labels['com.dockerflow.userId'] === userId;

        const isDockerFlowVolume = vol.Name.startsWith('dockerflow_');

        logger.info(`Volume ${vol.Name}:`, {
          hasRequiredLabels,
          isDockerFlowVolume,
          userId,
          volumeLabels: vol.Labels
        });

        // Ne garder que les volumes avec les bons labels
        return hasRequiredLabels;
      });

      logger.info(`Filtered ${dockerVolumes.length} volumes for user ${userId}`);

      // 2. Créer un mapping des volumes utilisés par les conteneurs
      const volumeUsage = new Map<string, string[]>();
      containers.forEach(container => {
        const mounts = container.Mounts || [];
        mounts.forEach(mount => {
          if (mount.Type === 'volume' && mount.Name) {
            if (!volumeUsage.has(mount.Name)) {
              volumeUsage.set(mount.Name, []);
            }
            const containerName = container.Names?.[0]?.replace('/', '') || container.Id;
            volumeUsage.get(mount.Name)?.push(containerName);
          }
        });
      });

      // 3. Synchroniser les volumes avec la base de données
      const synchronizedVolumes = await dockerVolumeSync.synchronizeVolumes(session.user.id);
      logger.info(`Synchronized ${synchronizedVolumes.length} volumes for user ${session.user.id}`);

      // 4. Enrichir les volumes synchronisés avec les informations d'utilisation
      const enrichedVolumes = synchronizedVolumes.map(volume => {
        return {
          ...volume,
          UsedBy: volumeUsage.get(volume.name) || [],
          Status: volumeUsage.has(volume.name) ? 'active' : 'unused'
        };
      });

      return NextResponse.json({
        Volumes: enrichedVolumes
      });
    } catch (dockerError) {
      logger.error('Error communicating with Docker:', dockerError);
      
      // Récupérer les volumes depuis la base de données même si Docker n'est pas disponible
      const dbVolumes = await prisma.volume.findMany({
        where: {
          userId: session.user.id,
          deletedAt: null
        },
        include: {
          containerVolumes: true
        }
      });
      
      logger.info(`Returning ${dbVolumes.length} volumes from database (Docker unavailable)`);
      
      return NextResponse.json({
        Volumes: dbVolumes.map(volume => ({
          ...volume,
          UsedBy: [],
          Status: 'unknown',
          existsInDocker: false
        }))
      });
    }
  } catch (error) {
    logger.error('Error fetching volumes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch volumes', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    
    if (!session?.user?.id) {
      logger.warn('Unauthorized attempt to create volume');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validation des données d'entrée
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      logger.error('Invalid JSON in request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    let validatedData;
    try {
      validatedData = createVolumeSchema.parse(body);
    } catch (validationError) {
      logger.error('Validation error:', validationError);
      return NextResponse.json(
        { error: 'Validation failed', details: validationError },
        { status: 400 }
      );
    }

    const { name, driver } = validatedData;
    logger.info(`Processing volume creation request: ${name}`);
    
    // Vérification des limites de stockage
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { storageLimit: true }
    });

    if (!user) {
      logger.error(`User not found: ${session.user.id}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentUsage = await getUserStorageUsage(session.user.id);
    if (currentUsage >= user.storageLimit) {
      logger.warn(`Storage limit exceeded for user ${session.user.id}`);
      return NextResponse.json(
        { error: 'Storage limit exceeded' },
        { status: 400 }
      );
    }
    
    // Initialisation du client Docker
    let docker;
    try {
      docker = await getDockerClient();
      await docker.info();
    } catch (dockerError) {
      logger.error('Failed to connect to Docker:', dockerError);
      return NextResponse.json(
        { error: 'Docker service unavailable' },
        { status: 503 }
      );
    }
    
    // Étape 1: Vérifier l'existence du volume dans Docker
    logger.info(`Checking if volume ${name} exists in Docker`);
    let volumes;
    try {
      volumes = await docker.listVolumes();
    } catch (listError) {
      logger.error('Error listing Docker volumes:', listError);
      return NextResponse.json(
        { error: 'Failed to list Docker volumes' },
        { status: 500 }
      );
    }
    
    // Rechercher le volume Docker existant
    let existingDockerVolume = null;
    if (volumes.Volumes && Array.isArray(volumes.Volumes)) {
      existingDockerVolume = volumes.Volumes.find(vol => 
        vol && typeof vol === 'object' && 
        'Name' in vol && 
        vol.Name && 
        String(vol.Name) === name
      );
    }
    
    // Étape 2: Vérifier l'existence du volume dans la base de données
    const existingVolume = await prisma.volume.findFirst({
      where: {
        name,
        userId: session.user.id,
        deletedAt: null
      }
    });
    
    // Gestion des différents cas
    try {
      // CAS 1: Le volume existe déjà dans la base de données
      if (existingVolume) {
        logger.info(`Volume ${name} already exists in database`);
        
        // Sous-cas 1.1: Le volume existe aussi dans Docker - tout est synchronisé
        if (existingDockerVolume) {
          logger.info(`Volume ${name} is correctly synchronized between Docker and database`);
          return NextResponse.json(existingVolume);
        } 
        // Sous-cas 1.2: Le volume n'existe pas dans Docker - on le crée dans Docker
        else {
          logger.info(`Volume ${name} exists in DB but not in Docker - creating in Docker`);
          try {
            const newDockerVolume = await docker.createVolume({
              Name: name,
              Driver: driver,
              Labels: {
                'com.dockerflow.managed': 'true',
                'com.dockerflow.userId': session.user.id
              }
            });
            
            // Mise à jour des informations dans la BD
            const updatedVolume = await prisma.volume.update({
              where: { id: existingVolume.id },
              data: {
                mountpoint: newDockerVolume.Mountpoint,
                driver: newDockerVolume.Driver
              }
            });
            
            await prisma.activity.create({
              data: {
                type: ActivityType.VOLUME_CREATE,
                description: `Volume ${name} recreated in Docker`,
                userId: session.user.id,
                metadata: {
                  volumeId: updatedVolume.id,
                  volumeName: updatedVolume.name
                } as Prisma.JsonValue
              }
            });
            
            return NextResponse.json(updatedVolume);
          } catch (dockerError) {
            logger.error(`Error creating volume in Docker: ${dockerError}`);
            // Si on ne peut pas créer le volume dans Docker, on retourne quand même le volume existant
            return NextResponse.json(existingVolume);
          }
        }
      }
      
      // CAS 2: Le volume existe dans Docker mais pas dans la BD
      if (existingDockerVolume) {
        logger.info(`Volume ${name} exists in Docker but not in DB - synchronizing`);
        const volume = await prisma.volume.create({
          data: {
            name,
            driver: existingDockerVolume.Driver,
            mountpoint: existingDockerVolume.Mountpoint,
            size: 0,
            userId: session.user.id
          }
        });
        
        await prisma.activity.create({
          data: {
            type: ActivityType.VOLUME_CREATE,
            description: `Volume ${name} synchronized from Docker`,
            userId: session.user.id,
            metadata: {
              volumeId: volume.id,
              volumeName: volume.name,
              driver: volume.driver
            } as Prisma.JsonValue
          }
        });
        
        return NextResponse.json(volume);
      }
      
      // CAS 3: Le volume n'existe ni dans Docker ni dans la BD - création complète
      logger.info(`Volume ${name} does not exist - creating new volume`);
      const newDockerVolume = await docker.createVolume({
        Name: name,
        Driver: driver,
        Labels: {
          'com.dockerflow.managed': 'true',
          'com.dockerflow.userId': session.user.id
        }
      });
      
      const volume = await prisma.volume.create({
        data: {
          name,
          driver: newDockerVolume.Driver,
          mountpoint: newDockerVolume.Mountpoint,
          size: 0,
          userId: session.user.id
        }
      });
      
      await prisma.activity.create({
        data: {
          type: ActivityType.VOLUME_CREATE,
          description: `Volume ${name} created`,
          userId: session.user.id,
          metadata: {
            volumeId: volume.id,
            volumeName: volume.name
          } as Prisma.JsonValue
        }
      });
      
      return NextResponse.json(volume);
    } catch (error) {
      logger.error('Error in volume creation process:', error);
      return NextResponse.json(
        { error: 'Failed to create volume', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Unexpected error in volume creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}