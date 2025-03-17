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

const createVolumeSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9-]+$/, 'Volume name must contain only letters, numbers, and hyphens'),
  driver: z.string().optional().default('local'),
});

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Utiliser l'utilitaire de synchronisation des volumes
    const synchronizedVolumes = await dockerVolumeSync.synchronizeVolumes(session.user.id, true);
    return NextResponse.json(synchronizedVolumes);
  } catch (error) {
    console.error('Error fetching volumes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch volumes' },
      { status: 500 }
    );
  }
}

/**
 * Synchronise les volumes entre Docker et la base de données
 * @param userId - ID de l'utilisateur
 * @returns Liste des volumes synchronisés
 */
async function synchronizeVolumes(userId: string, forceFullSync: boolean = false) {
  console.log(`[API] Synchronisation des volumes pour l'utilisateur ${userId}, synchronisation complète: ${forceFullSync}`);
  // 1. Récupérer les volumes depuis la base de données
  const dbVolumes = await prisma.volume.findMany({
    where: {
      userId: userId
    },
    include: {
      containerVolumes: {
        select: {
          id: true,
          mountPath: true,
          container: {
            select: {
              name: true,
              status: true
            }
          }
        }
      }
    }
  });

  // Créer un Map des volumes en base de données pour un accès rapide
  const dbVolumeMap = new Map(dbVolumes.map(vol => [vol.name, vol]));
  
  // 2. Récupérer les volumes depuis Docker
  let dockerVolumes: any[] = [];
  let docker;
  
  try {
    docker = await getDockerClient();
    const dockerVolumesResponse = await docker.listVolumes();
    dockerVolumes = dockerVolumesResponse.Volumes || [];
    console.log(`[API] Volumes Docker récupérés: ${dockerVolumes.length}`);
  } catch (dockerError) {
    console.error('[API] Erreur lors de la récupération des volumes Docker:', dockerError);
    // Si Docker n'est pas disponible, on retourne les volumes de la BD tels quels
    return dbVolumes.map(volume => ({
      ...volume,
      existsInDocker: false // On marque tous les volumes comme non existants dans Docker
    }));
  }
  
  // 3. Identifier les volumes à supprimer, mettre à jour ou ajouter
  const volumesToUpdate: string[] = [];
  const volumesToRemove: string[] = [];
  const volumesToAdd: any[] = [];
  
  // Créer un ensemble des noms de volumes Docker pour une recherche efficace
  const dockerVolumeNames = new Set(dockerVolumes.map(vol => vol.Name));
  const dockerVolumeMap = new Map(dockerVolumes.map(vol => [vol.Name, vol]));
  
  // Vérifier quels volumes de la BD n'existent plus dans Docker
  for (const dbVolume of dbVolumes) {
    if (!dockerVolumeNames.has(dbVolume.name)) {
      // Le volume n'existe plus dans Docker
      volumesToRemove.push(dbVolume.id);
    } else {
      // Le volume existe toujours, vérifier s'il faut le mettre à jour
      const dockerVolume = dockerVolumeMap.get(dbVolume.name);
      if (dockerVolume && dbVolume.mountpoint !== dockerVolume.Mountpoint) {
        volumesToUpdate.push(dbVolume.id);
      }
    }
  }
  
  // Identifier les volumes Docker qui ne sont pas dans la BD
  for (const dockerVolume of dockerVolumes) {
    if (!dbVolumeMap.has(dockerVolume.Name)) {
      volumesToAdd.push(dockerVolume);
    }
  }
  
  console.log(`[API] Volumes à supprimer: ${volumesToRemove.length}, à mettre à jour: ${volumesToUpdate.length}, à ajouter: ${volumesToAdd.length}`);
  
  // 4. Effectuer les opérations de synchronisation
  const transactions = [];
  
  // Supprimer les volumes qui n'existent plus dans Docker
  if (volumesToRemove.length > 0 && volumesToRemove.length < 100) { // Sécurité pour éviter les requêtes trop grandes
    // Utiliser une approche alternative pour marquer les volumes comme supprimés
    for (const volumeId of volumesToRemove) {
      // Vérifier si le volume n'est pas utilisé par des conteneurs
      const volume = await prisma.volume.findUnique({
        where: { id: volumeId },
        include: { containerVolumes: true }
      });
      
      if (volume && volume.containerVolumes.length === 0) {
        transactions.push(
          prisma.volume.update({
            where: { id: volumeId },
            data: { 
              // Utiliser une propriété existante pour marquer la suppression
              // puisque deletedAt n'est pas encore reconnu par le typage
              mountpoint: 'DELETED_' + (volume.mountpoint || new Date().toISOString())
            }
          })
        );
      }
    }
  }
  
  // Mettre à jour les volumes existants
  for (const volumeId of volumesToUpdate) {
    const dbVolume = dbVolumes.find(v => v.id === volumeId);
    if (dbVolume) {
      const dockerVolume = dockerVolumeMap.get(dbVolume.name);
      if (dockerVolume) {
        transactions.push(
          prisma.volume.update({
            where: { id: volumeId },
            data: {
              mountpoint: dockerVolume.Mountpoint,
              // Mettre à jour d'autres propriétés si nécessaire
            }
          })
        );
      }
    }
  }
  
  // Ajouter les nouveaux volumes
  for (const dockerVolume of volumesToAdd) {
    transactions.push(
      prisma.volume.create({
        data: {
          name: dockerVolume.Name,
          driver: dockerVolume.Driver,
          mountpoint: dockerVolume.Mountpoint,
          size: 0, // Taille par défaut, à mettre à jour ultérieurement
          userId: userId
        }
      })
    );
  }
  
  // Exécuter les transactions si nécessaire
  if (transactions.length > 0) {
    await Promise.all(transactions);
  }
  
  // 5. Récupérer les volumes mis à jour
  const updatedVolumes = await prisma.volume.findMany({
    where: {
      userId: userId,
      // Exclure les volumes marqués comme supprimés (via le préfixe DELETED_)
      NOT: {
        mountpoint: { startsWith: 'DELETED_' }
      }
    },
    include: {
      containerVolumes: {
        select: {
          id: true,
          mountPath: true,
          container: {
            select: {
              name: true,
              status: true
            }
          }
        }
      }
    }
  });
  
  // Marquer tous les volumes comme existant dans Docker (puisqu'ils sont synchronisés)
  return updatedVolumes.map(volume => ({
    ...volume,
    existsInDocker: dockerVolumeNames.has(volume.name)
  }));
}

export async function POST(req: Request) {
  // Fonction utilitaire pour vérifier si un volume existe dans Docker
  async function checkVolumeExistsInDocker(volumeName: string): Promise<boolean> {
    try {
      const docker = await getDockerClient();
      const volumes = await docker.listVolumes();
      return volumes.Volumes.some(vol => vol.Name === volumeName);
    } catch (error) {
      console.error(`Erreur lors de la vérification du volume ${volumeName} dans Docker:`, error);
      return false;
    }
  }
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validatedData = createVolumeSchema.parse(body);
    const { name, driver } = validatedData;

    console.log(`Traitement de la demande de volume: ${name}`);
    
    // Vérification des limites de stockage
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { storageLimit: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentUsage = await getUserStorageUsage(session.user.id);
    if (currentUsage >= user.storageLimit) {
      return NextResponse.json(
        { error: 'Storage limit exceeded' },
        { status: 400 }
      );
    }
    
    // Initialisation du client Docker
    const docker = await getDockerClient();
    
    try {
      // Vérifier que Docker est accessible
      await docker.info();
      
      // Étape 1: Vérifier l'existence du volume dans Docker
      console.log(`Vérification de l'existence du volume ${name} dans Docker`);
      const volumes = await docker.listVolumes();
      const existingDockerVolume = volumes.Volumes.find(vol => typeof vol.Name === 'string' && vol.Name === name);
      
      // Étape 2: Vérifier l'existence du volume dans la base de données
      const existingVolume = await prisma.volume.findFirst({
        where: {
          name,
          userId: session?.user?.id,
          deletedAt: null
        }
      });
      
      // CAS 1: Le volume existe déjà dans la base de données
      if (existingVolume) {
        console.log(`Volume ${name} existe déjà dans la base de données`);
        
        // Sous-cas 1.1: Le volume existe aussi dans Docker - tout est synchronisé
        if (existingDockerVolume) {
          console.log(`Volume ${name} est correctement synchronisé entre Docker et la base de données`);
          return NextResponse.json(existingVolume);
        } 
        // Sous-cas 1.2: Le volume n'existe pas dans Docker - on le crée dans Docker
        else {
          console.log(`Volume ${name} existe dans la BD mais pas dans Docker - création dans Docker`);
          try {
            const newDockerVolume = await docker.createVolume({
              Name: name,
              Driver: driver,
              Labels: {
                'com.dockerflow.managed': 'true',
                'com.dockerflow.userId': session?.user?.id || ''
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
                type: ActivityType.VOLUME_CREATE, // Utilisation de VOLUME_CREATE au lieu de VOLUME_UPDATE qui n'existe pas
                description: `Volume ${name} recréé dans Docker`,
                userId: session?.user?.id || '',
                metadata: {
                  volumeId: updatedVolume.id,
                  volumeName: updatedVolume.name
                } as Prisma.JsonValue
              }
            });
            
            return NextResponse.json(updatedVolume);
          } catch (dockerError: any) {
            console.error(`Erreur lors de la création du volume dans Docker: ${dockerError.message}`);
            // Si on ne peut pas créer le volume dans Docker, on retourne quand même le volume existant
            // pour ne pas bloquer l'utilisateur, mais on log l'erreur
            return NextResponse.json(existingVolume);
          }
        }
      }
      
      // CAS 2: Le volume existe dans Docker mais pas dans la BD
      if (existingDockerVolume) {
        console.log(`Volume ${name} existe dans Docker mais pas dans la BD - synchronisation`);
        const volume = await prisma.volume.create({
          data: {
            name,
            driver: existingDockerVolume.Driver,
            mountpoint: existingDockerVolume.Mountpoint,
            size: 0,
            userId: session?.user?.id || ''
          }
        });
        
        await prisma.activity.create({
          data: {
            type: ActivityType.VOLUME_CREATE,
            description: `Volume ${name} synchronisé depuis Docker`,
            userId: session?.user?.id || '',
            metadata: {
              volumeId: volume.id,
              volumeName: volume.name,
              driver: volume.driver
            } as Prisma.JsonValue
          }
        });
        
        return NextResponse.json(volume);
      }
      
      // CAS 3: Le volume n'existe ni dans Docker ni dans la BD - on le crée
      console.log(`Création d'un nouveau volume: ${name} avec driver: ${driver}`);
      
      // Création du volume dans Docker
      const newDockerVolume = await docker.createVolume({
        Name: name,
        Driver: driver,
        DriverOpts: {},
        Labels: {
          'com.dockerflow.managed': 'true',
          'com.dockerflow.userId': session?.user?.id || ''
        }
      });
      
      console.log(`Volume Docker créé avec succès: ${name}, mountpoint: ${newDockerVolume.Mountpoint}`);

      // Création de l'entrée dans la base de données
      const volume = await prisma.volume.create({
        data: {
          name,
          driver,
          mountpoint: newDockerVolume.Mountpoint,
          size: 0,
          userId: session?.user?.id || ''
        }
      });
      
      console.log(`Enregistrement du volume créé dans la base de données: ${volume.id}`);
      
      // Créer une activité pour le volume
      await prisma.activity.create({
        data: {
          type: ActivityType.VOLUME_CREATE,
          description: `Volume ${name} créé`,
          userId: session?.user?.id || '',
          metadata: {
            volumeId: volume.id,
            volumeName: volume.name,
            driver: volume.driver
          } as Prisma.JsonValue
        }
      });
      
      return NextResponse.json(volume);
    } catch (error: any) {
      // Gestion des erreurs Docker
      console.error(`Erreur lors de la gestion du volume ${name}:`, error);
      
      // Journalisation détaillée de l'erreur
      console.error('Détails de l\'erreur:', {
        message: error.message,
        code: error.statusCode || error.code,
        stack: error.stack
      });
      
      // Gestion spécifique des erreurs Docker
      if (error.statusCode === 403 || (error.message && error.message.includes('permission'))) {
        return NextResponse.json(
          { error: `Erreur de permission Docker: ${error.message}` },
          { status: 403 }
        );
      }
      
      // Gestion des erreurs de contrainte d'unicité
      if (error.message && (
        error.message.includes('constraint') || 
        error.message.includes('unique') || 
        error.message.includes('Unique constraint failed')
      )) {
        return NextResponse.json(
          { error: `Un volume avec le nom '${name}' existe déjà pour cet utilisateur` },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: `Échec de la gestion du volume: ${error.message || 'Erreur inconnue'}` },
        { status: 500 }
      );
    }

    console.log(`Tentative de création du volume Docker: ${name} avec driver: ${driver}`);
    
    // Vérifier les permissions Docker avant de créer le volume
    try {
      // Vérifier que Docker est accessible
      const info = await docker.info();
      console.log(`Docker info récupérée avec succès, version: ${info.ServerVersion}`);
      
      // Vérifier que nous pouvons lister les volumes (test de permission)
      const volumes = await docker.listVolumes();
      console.log(`Liste des volumes récupérée avec succès, nombre de volumes: ${volumes.Volumes.length}`);
      
      // Vérifier si le volume existe déjà dans Docker
      const foundExistingVolume = volumes.Volumes.find(vol => vol.Name === name);
      if (foundExistingVolume) {
        console.log(`Volume ${name} déjà existant dans Docker, réutilisation...`);
        
        // Créer l'entrée dans la base de données pour le volume existant
        const volume = await prisma.volume.create({
          data: {
            name,
            driver: foundExistingVolume?.Driver || 'local',
            mountpoint: foundExistingVolume?.Mountpoint || '',
            size: 0,
            userId: session?.user?.id || ''
          }
        });
        
        await prisma.activity.create({
          data: {
            type: ActivityType.VOLUME_CREATE,
            description: `Volume ${name} synchronisé depuis Docker`,
            userId: session?.user?.id || '',
            metadata: {
              volumeId: volume.id,
              volumeName: volume.name,
              driver: volume.driver
            } as Prisma.JsonValue
          }
        });
        
        return NextResponse.json(volume);
      }
      
      // Création du volume Docker avec gestion des erreurs spécifiques et options étendues
      console.log(`Création du volume Docker ${name} avec les options:`, {
        Name: name,
        Driver: driver,
        DriverOpts: {},
        Labels: {
          'com.dockerflow.managed': 'true',
          'com.dockerflow.userId': session?.user?.id || ''
        }
      });
      
      const createdDockerVolume = await docker.createVolume({
        Name: name,
        Driver: driver,
        DriverOpts: {},
        Labels: {
          'com.dockerflow.managed': 'true',
          'com.dockerflow.userId': session?.user?.id || ''
        }
      });
      
      console.log(`Volume Docker créé avec succès: ${name}, mountpoint: ${createdDockerVolume.Mountpoint}`);

      // Vérifier si le volume existe déjà dans la base de données (double vérification)
      const existingVolumeInDb = await prisma.volume.findFirst({
        where: {
          name,
          userId: session?.user?.id || ''
        }
      });
      
      if (existingVolumeInDb) {
        console.log(`Volume ${name} déjà existant dans la base de données, mise à jour...`);
        // Mettre à jour le volume existant avec les nouvelles informations de Docker
        const updatedVolume = await prisma.volume.update({
          where: { id: existingVolumeInDb.id },
          data: {
            driver: createdDockerVolume?.Driver || 'local',
            mountpoint: createdDockerVolume?.Mountpoint || '',
            // Ne pas écraser la taille si elle est déjà définie
            size: existingVolumeInDb?.size && existingVolumeInDb.size > 0 ? existingVolumeInDb.size : 0
          }
        });
        
        // Créer une activité pour la mise à jour du volume
        await prisma.activity.create({
          data: {
            type: ActivityType.VOLUME_CREATE,
            description: `Volume ${name} mis à jour`,
            userId: session?.user?.id || '',
            metadata: {
              volumeId: updatedVolume.id,
              volumeName: updatedVolume.name,
              driver: updatedVolume.driver
            } as Prisma.JsonValue
          }
        });
        
        return NextResponse.json(updatedVolume);
      }
      
      // Création de l'entrée dans la base de données
      const volume = await prisma.volume.create({
        data: {
          name,
          driver,
          mountpoint: createdDockerVolume.Mountpoint,
          size: 0,
          userId: session?.user?.id || ''
        }
      });
      console.log(`Enregistrement du volume créé dans la base de données: ${volume.id}`);
      
      // Créer une activité pour le volume
      await prisma.activity.create({
        data: {
          type: ActivityType.VOLUME_CREATE,
          description: `Volume ${name} créé`,
          userId: session?.user?.id || '',
          metadata: {
            volumeId: volume.id,
            volumeName: volume.name,
            driver: volume.driver
          } as Prisma.JsonValue
        }
      });
      
      return NextResponse.json(volume);
    } catch (error: any) {
      console.error(`Erreur lors de la création du volume ${name}:`, error);
      console.error(`Détails de l'erreur:`, {
        message: error.message,
        stack: error.stack,
        code: error.statusCode || error.code,
        reason: error.reason || 'Inconnue'
      });
      
      // Vérifier si l'erreur est due à un volume qui existe déjà dans Docker
      if (error.message && error.message.includes('already exists')) {
        console.log(`Le volume ${name} existe déjà dans Docker, tentative de synchronisation...`);
        
        try {
          // Récupérer les informations du volume existant
          const volumes = await docker.listVolumes();
          const foundDockerVolume = volumes.Volumes.find(vol => vol.Name === name);
          
          if (foundDockerVolume) {
            // Créer l'entrée dans la base de données pour le volume existant
            const volume = await prisma.volume.create({
              data: {
                name,
                driver: foundDockerVolume?.Driver || 'local',
                mountpoint: foundDockerVolume?.Mountpoint || '',
                size: 0,
                userId: session?.user?.id || ''
              }
            });
            
            await prisma.activity.create({
              data: {
                type: ActivityType.VOLUME_CREATE,
                description: `Volume ${name} synchronisé depuis Docker`,
                userId: session?.user?.id || '',
                metadata: {
                  volumeId: volume.id,
                  volumeName: volume.name,
                  driver: volume.driver
                } as Prisma.JsonValue
              }
            });
            
            return NextResponse.json(volume);
          }
        } catch (syncError) {
          console.error(`Erreur lors de la synchronisation du volume existant ${name}:`, syncError);
        }
        
        return NextResponse.json(
          { error: `Le volume ${name} existe déjà dans Docker mais n'a pas pu être synchronisé` },
          { status: 400 }
        );
      }
      
      // Vérifier si l'erreur est due à un problème de permission
      if (error.message && (error.message.includes('permission') || error.message.includes('access') || error.statusCode === 403)) {
        return NextResponse.json(
          { error: `Erreur de permission Docker: ${error.message}` },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: `Échec de la création du volume: ${error.message || 'Erreur inconnue'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating volume:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid volume data', details: error.errors },
        { status: 400 }
      );
    }
    
    // Gestion spécifique des erreurs de contrainte d'unicité
    const errorObj = error as any; // Cast pour accéder aux propriétés
    
    if (errorObj.message && (
      errorObj.message.includes('constraint') || 
      errorObj.message.includes('unique') || 
      errorObj.message.includes('volumes.name') ||
      errorObj.message.includes('Unique constraint failed')
    )) {
      console.log(`Erreur de contrainte d'unicité détectée pour le volume ${name}`);
      
      // Vérifier si le volume existe déjà dans Docker
      try {
        const docker = await getDockerClient();
        const volumes = await docker.listVolumes();
        // Vérification explicite du type et de la valeur
        const existingVolume = volumes.Volumes.find(vol => {
          return vol.Name && typeof vol.Name === 'string' && vol.Name === name;
        }) || null;
        
        if (existingVolume) {
          return NextResponse.json(
            { error: `Un volume avec le nom '${name}' existe déjà. Veuillez utiliser un autre nom.` },
            { status: 400 }
          );
        }
      } catch (dockerError) {
        console.error('Erreur lors de la vérification dans Docker:', dockerError);
      }
      
      return NextResponse.json(
        { error: `Un volume avec le nom '${name}' existe déjà pour cet utilisateur. Veuillez utiliser un autre nom.` },
        { status: 400 }
      );
    }
    
    // Gestion des autres erreurs
    const errorMessage = errorObj.message || 'Failed to create volume';
    console.error('Détails de l\'erreur:', {
      message: errorMessage,
      code: errorObj.code,
      meta: errorObj.meta
    });
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const volumeId = searchParams.get('id');

    if (!volumeId) {
      return NextResponse.json(
        { error: 'Volume ID is required' },
        { status: 400 }
      );
    }

    const volume = await prisma.volume.findFirst({
      where: {
        id: volumeId,
        userId: session.user.id
      }
    });

    if (!volume) {
      return NextResponse.json(
        { error: 'Volume not found or unauthorized' },
        { status: 404 }
      );
    }

    const docker = await getDockerClient();

    try {
      await docker.getVolume(volume.name).remove();
    } catch (error) {
      console.error('Error removing Docker volume:', error);
    }

    await prisma.volume.delete({
      where: {
        id: volumeId
      }
    });

    // Synchroniser la base de données après la suppression
    await dockerVolumeSync.synchronizeVolumes(session.user.id, true);
    
    await prisma.activity.create({
      data: {
        type: ActivityType.VOLUME_DELETE,
        description: `Volume ${volume.name} deleted`,
        userId: session?.user?.id || '',
        metadata: {
          volumeId: volume.id,
          volumeName: volume.name
        } as Prisma.JsonValue
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting volume:', error);
    return NextResponse.json(
      { error: 'Failed to delete volume' },
      { status: 500 }
    );
  }
}