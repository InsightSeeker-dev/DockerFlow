import { prisma } from '../../lib/prisma';
import { getDockerClient } from './client';
import { Prisma, ActivityType, Volume as PrismaVolume } from '@prisma/client';

interface ContainerAssociation {
  containerId: string;
  containerName: string;
  mountPath: string;
}

interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  Labels?: Record<string, string>;
}

interface DockerMount {
  Type: string;
  Name?: string;
  Destination: string;
}

interface DockerContainer {
  Id: string;
  Names?: string[];
  Mounts?: DockerMount[];
}

// Interface étendue qui inclut les relations Prisma
interface Volume extends PrismaVolume {
  containerVolumes: {
    containerId: string;
    mountPath: string;
    container?: {
      id: string;
      name: string;
      status: string;
    };
  }[];
}

type PrismaTransaction = Prisma.PrismaPromise<any>;

/**
 * Classe utilitaire pour la synchronisation des volumes entre Docker et la base de données
 * Implémente le pattern Singleton pour garantir une instance unique
 */
export class DockerVolumeSync {
  private static instance: DockerVolumeSync;
  private isSyncing: boolean = false;
  private transactions: PrismaTransaction[] = [];

  private constructor() {}

  /**
   * Obtient l'instance unique de DockerVolumeSync
   * @returns L'instance de DockerVolumeSync
   */
  public static getInstance(): DockerVolumeSync {
    if (!DockerVolumeSync.instance) {
      DockerVolumeSync.instance = new DockerVolumeSync();
    }
    return DockerVolumeSync.instance;
  }

  /**
   * Vérifie si un volume existe dans Docker
   * @param volumeName Nom du volume à vérifier
   * @returns true si le volume existe, false sinon
   */
  public async checkVolumeExistsInDocker(volumeName: string): Promise<boolean> {
    try {
      const docker = await getDockerClient();
      const { Volumes } = await docker.listVolumes();
      return (Volumes || []).some((vol: DockerVolume) => vol.Name === volumeName);
    } catch (error) {
      console.error(`[DockerVolumeSync] Erreur lors de la vérification du volume ${volumeName}:`, error);
      return false;
    }
  }

  /**
   * Vérifie si les associations de conteneurs pour un volume ont changé
   * @param volumeName Nom du volume
   * @param currentAssociations Associations actuelles
   * @param newAssociations Nouvelles associations
   * @returns true si les associations ont changé, false sinon
   */
  private hasContainerChanges(
    volumeName: string,
    currentAssociations: ContainerAssociation[],
    newAssociations: ContainerAssociation[]
  ): boolean {
    if (currentAssociations.length !== newAssociations.length) {
      console.log(`[DockerVolumeSync] Le nombre d'associations pour le volume ${volumeName} a changé`);
      return true;
    }

    // Création de maps pour une comparaison plus efficace
    const currentMap = new Map<string, string>();
    for (const assoc of currentAssociations) {
      currentMap.set(assoc.containerId, assoc.mountPath);
    }

    for (const assoc of newAssociations) {
      const mountPath = currentMap.get(assoc.containerId);
      if (!mountPath || mountPath !== assoc.mountPath) {
        console.log(`[DockerVolumeSync] Les associations pour le volume ${volumeName} ont changé`);
        return true;
      }
    }

    return false;
  }

  /**
   * Exécute les transactions en attente dans la base de données
   * @returns Résultat des transactions
   */
  private async executeTransactions(): Promise<any[]> {
    if (this.transactions.length === 0) {
      return [];
    }

    try {
      const results = await prisma.$transaction(this.transactions);
      console.log(`[DockerVolumeSync] ${this.transactions.length} transactions exécutées avec succès`);
      this.transactions = [];
      return results;
    } catch (error) {
      console.error('[DockerVolumeSync] Erreur lors de l\'exécution des transactions:', error);
      this.transactions = [];
      throw error;
    }
  }

  /**
   * Synchronise les volumes entre Docker et la base de données
   * @param userId ID de l'utilisateur pour lequel synchroniser les volumes
   * @returns true si la synchronisation a réussi, false sinon
   */
  public async synchronizeVolumes(userId: string): Promise<boolean> {
    if (this.isSyncing) {
      console.log('[DockerVolumeSync] Une synchronisation est déjà en cours, opération ignorée');
      return false;
    }

    this.isSyncing = true;
    console.log(`[DockerVolumeSync] Démarrage de la synchronisation des volumes pour l'utilisateur ${userId}`);

    try {
      const docker = await getDockerClient();
      
      // Récupération des volumes Docker
      const { Volumes: dockerVolumes = [] } = await docker.listVolumes();
      console.log(`[DockerVolumeSync] ${dockerVolumes.length} volumes trouvés dans Docker`);

      // Récupération des conteneurs Docker
      const containers = await docker.listContainers({ all: true });
      console.log(`[DockerVolumeSync] ${containers.length} conteneurs trouvés dans Docker`);

      // Création d'une map des associations volume-conteneur à partir des conteneurs Docker
      const containerVolumeMap = new Map<string, ContainerAssociation[]>();
      
      for (const container of containers) {
        const containerInfo = container as unknown as DockerContainer;
        const containerName = containerInfo.Names?.[0]?.replace(/^\//, '') || '';
        
        if (containerInfo.Mounts) {
          for (const mount of containerInfo.Mounts) {
            if (mount.Type === 'volume' && mount.Name) {
              const volumeName = mount.Name;
              const association: ContainerAssociation = {
                containerId: containerInfo.Id,
                containerName,
                mountPath: mount.Destination
              };

              if (!containerVolumeMap.has(volumeName)) {
                containerVolumeMap.set(volumeName, []);
              }
              containerVolumeMap.get(volumeName)?.push(association);
            }
          }
        }
      }

      // Récupération des volumes de la base de données pour l'utilisateur
      const dbVolumes = await prisma.volume.findMany({
        where: { userId },
        include: {
          containerVolumes: {
            include: {
              container: {
                select: {
                  id: true,
                  name: true,
                  status: true
                }
              }
            }
          }
        }
      }) as Volume[];
      
      console.log(`[DockerVolumeSync] ${dbVolumes.length} volumes trouvés en base de données pour l'utilisateur ${userId}`);

      // Création des ensembles pour suivre les volumes à ajouter, mettre à jour ou supprimer
      const volumesToUpdate = new Set<string>();
      const volumesToAdd = new Set<string>();
      const volumesToRemove = new Set<string>();
      
      // Map des volumes de la base de données pour un accès plus rapide
      const dbVolumeMap = new Map<string, Volume>();
      for (const volume of dbVolumes) {
        dbVolumeMap.set(volume.name, volume);
      }

      // Vérification des volumes Docker qui doivent être ajoutés ou mis à jour
      for (const dockerVolume of dockerVolumes) {
        const volumeName = dockerVolume.Name;
        
        // Si le volume est déjà dans la base de données
        if (dbVolumeMap.has(volumeName)) {
          const dbVolume = dbVolumeMap.get(volumeName)!;
          const currentAssociations: ContainerAssociation[] = dbVolume.containerVolumes.map(cv => ({
            containerId: cv.containerId,
            containerName: cv.container?.name || '',
            mountPath: cv.mountPath
          }));
          
          const newAssociations = containerVolumeMap.get(volumeName) || [];
          
          // Vérifier si les associations ont changé
          if (this.hasContainerChanges(volumeName, currentAssociations, newAssociations)) {
            volumesToUpdate.add(volumeName);
          }
        } else {
          // Le volume n'existe pas dans la base de données, il doit être ajouté
          volumesToAdd.add(volumeName);
        }
      }

      // Vérification des volumes de la base de données qui ne sont plus dans Docker
      for (const dbVolume of dbVolumes) {
        const volumeName = dbVolume.name;
        if (!dockerVolumes.some(dv => dv.Name === volumeName)) {
          volumesToRemove.add(volumeName);
        }
      }

      console.log(`[DockerVolumeSync] Volumes à traiter - Ajouts: ${volumesToAdd.size}, Mises à jour: ${volumesToUpdate.size}, Suppressions: ${volumesToRemove.size}`);

      // Ajout des nouveaux volumes
      for (const volumeName of Array.from(volumesToAdd)) {
        const dockerVolume = dockerVolumes.find(v => v.Name === volumeName);
        if (!dockerVolume) continue;

        const containerAssociations = containerVolumeMap.get(volumeName) || [];
        
        // Création du volume dans la base de données
        this.transactions.push(
          prisma.volume.create({
            data: {
              name: volumeName,
              driver: dockerVolume.Driver,
              mountpoint: dockerVolume.Mountpoint,
              userId,
              created: new Date(),
              containerVolumes: {
                create: containerAssociations.map(assoc => ({
                  containerId: assoc.containerId,
                  mountPath: assoc.mountPath
                }))
              }
            }
          })
        );
        
        // Création d'une activité pour l'ajout du volume
        this.transactions.push(
          prisma.activity.create({
            data: {
              type: ActivityType.VOLUME_CREATE,
              userId,
              createdAt: new Date(),
              description: `Volume ${volumeName} created`,
              metadata: { volumeName }
            }
          })
        );
      }

      // Mise à jour des volumes existants
      for (const volumeName of Array.from(volumesToUpdate)) {
        const dockerVolume = dockerVolumes.find(v => v.Name === volumeName);
        const dbVolume = dbVolumeMap.get(volumeName);
        const containerAssociations = containerVolumeMap.get(volumeName) || [];
        
        if (!dockerVolume || !dbVolume) continue;

        // Suppression des associations existantes
        this.transactions.push(
          prisma.containerVolume.deleteMany({
            where: {
              volumeId: dbVolume.id
            }
          })
        );

        // Mise à jour du volume et création des nouvelles associations
        this.transactions.push(
          prisma.volume.update({
            where: {
              id: dbVolume.id
            },
            data: {
              driver: dockerVolume.Driver,
              mountpoint: dockerVolume.Mountpoint,
              containerVolumes: {
                create: containerAssociations.map(assoc => ({
                  containerId: assoc.containerId,
                  mountPath: assoc.mountPath
                }))
              }
            }
          })
        );
        
        // Création d'une activité pour la mise à jour du volume
        this.transactions.push(
          prisma.activity.create({
            data: {
              type: ActivityType.VOLUME_MOUNT,
              userId,
              createdAt: new Date(),
              description: `Volume ${volumeName} updated`,
              metadata: { volumeName }
            }
          })
        );
      }

      // Suppression des volumes qui n'existent plus dans Docker
      for (const volumeName of Array.from(volumesToRemove)) {
        const dbVolume = dbVolumeMap.get(volumeName);
        if (!dbVolume) continue;

        // Création d'une activité de suppression
        this.transactions.push(
          prisma.activity.create({
            data: {
              type: ActivityType.VOLUME_DELETE,
              userId,
              createdAt: new Date(),
              description: `Volume ${volumeName} deleted`,
              metadata: { volumeName }
            }
          })
        );

        // Suppression des associations conteneur-volume
        this.transactions.push(
          prisma.containerVolume.deleteMany({
            where: {
              volumeId: dbVolume.id
            }
          })
        );

        // Suppression du volume
        this.transactions.push(
          prisma.volume.delete({
            where: {
              id: dbVolume.id
            }
          })
        );
      }

      // Exécution des transactions
      await this.executeTransactions();
      console.log(`[DockerVolumeSync] Synchronisation des volumes terminée pour l'utilisateur ${userId}`);
      
      return true;
    } catch (error: unknown) {
      console.error('[DockerVolumeSync] Erreur lors de la synchronisation des volumes:', error);
      throw error;
    } finally {
      this.isSyncing = false;
      console.log(`[DockerVolumeSync] Fin de la synchronisation des volumes pour l'utilisateur ${userId}`);
    }
  }
}
