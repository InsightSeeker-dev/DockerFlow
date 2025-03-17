import { prisma } from '@/lib/prisma';
import { getDockerClient } from './client';
import { ActivityType } from '@prisma/client';
import { Prisma } from '@prisma/client';

/**
 * Classe utilitaire pour la synchronisation des volumes entre Docker et la base de données
 * Implémente le pattern Singleton pour garantir une instance unique
 */
export class DockerVolumeSync {
  private static instance: DockerVolumeSync;
  private isSyncing: boolean = false;
  
  private constructor() {}
  
  /**
   * Obtenir l'instance unique de DockerVolumeSync
   */
  public static getInstance(): DockerVolumeSync {
    if (!DockerVolumeSync.instance) {
      DockerVolumeSync.instance = new DockerVolumeSync();
    }
    return DockerVolumeSync.instance;
  }
  
  /**
   * Synchronise les volumes entre Docker et la base de données
   * @param userId - ID de l'utilisateur
   * @param forceFullSync - Force une synchronisation complète même si une synchronisation est déjà en cours
   * @returns Liste des volumes synchronisés
   */
  public async synchronizeVolumes(userId: string, forceFullSync: boolean = false): Promise<any[]> {
    // Éviter les synchronisations simultanées sauf si forcé
    if (this.isSyncing && !forceFullSync) {
      console.log(`[DockerVolumeSync] Synchronisation déjà en cours pour l'utilisateur ${userId}, ignoré.`);
      return [];
    }
    
    try {
      this.isSyncing = true;
      console.log(`[DockerVolumeSync] Début de la synchronisation des volumes pour l'utilisateur ${userId}`);
      
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
      
      console.log(`[DockerVolumeSync] ${dbVolumes.length} volumes trouvés dans la base de données`);
      
      // Créer un Map des volumes en base de données pour un accès rapide
      const dbVolumeMap = new Map(dbVolumes.map(vol => [vol.name, vol]));
      
      // 2. Récupérer les volumes depuis Docker
      let dockerVolumes: any[] = [];
      let docker;
      
      try {
        docker = await getDockerClient();
        const dockerVolumesResponse = await docker.listVolumes();
        dockerVolumes = dockerVolumesResponse.Volumes || [];
        console.log(`[DockerVolumeSync] ${dockerVolumes.length} volumes récupérés depuis Docker`);
      } catch (dockerError) {
        console.error('[DockerVolumeSync] Erreur lors de la récupération des volumes Docker:', dockerError);
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
          console.log(`[DockerVolumeSync] Volume ${dbVolume.name} n'existe plus dans Docker, marqué pour suppression`);
        } else {
          // Le volume existe toujours, vérifier s'il faut le mettre à jour
          const dockerVolume = dockerVolumeMap.get(dbVolume.name);
          if (dockerVolume && dbVolume.mountpoint !== dockerVolume.Mountpoint) {
            volumesToUpdate.push(dbVolume.id);
            console.log(`[DockerVolumeSync] Volume ${dbVolume.name} a changé, marqué pour mise à jour`);
          }
        }
      }
      
      // Identifier les volumes Docker qui ne sont pas dans la BD
      for (const dockerVolume of dockerVolumes) {
        if (!dbVolumeMap.has(dockerVolume.Name)) {
          volumesToAdd.push(dockerVolume);
          console.log(`[DockerVolumeSync] Nouveau volume Docker ${dockerVolume.Name} trouvé, sera ajouté à la BD`);
        }
      }
      
      console.log(`[DockerVolumeSync] Volumes à supprimer: ${volumesToRemove.length}, à mettre à jour: ${volumesToUpdate.length}, à ajouter: ${volumesToAdd.length}`);
      
      // 4. Effectuer les opérations de synchronisation
      const transactions = [];
      
      // Supprimer les volumes qui n'existent plus dans Docker
      if (volumesToRemove.length > 0 && volumesToRemove.length < 100) { // Sécurité pour éviter les requêtes trop grandes
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
                  mountpoint: 'DELETED_' + (volume.mountpoint || new Date().toISOString())
                }
              })
            );
            
            // Créer une activité pour la suppression du volume
            await prisma.activity.create({
              data: {
                type: ActivityType.VOLUME_DELETE,
                description: `Volume ${volume.name} supprimé lors de la synchronisation (absent de Docker)`,
                userId: userId,
                metadata: {
                  volumeId: volume.id,
                  volumeName: volume.name
                } as Prisma.JsonValue
              }
            });
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
                  mountpoint: dockerVolume.Mountpoint || '',
                  driver: dockerVolume.Driver || 'local'
                }
              })
            );
            
            // Créer une activité pour la mise à jour du volume
            await prisma.activity.create({
              data: {
                type: ActivityType.VOLUME_CREATE,
                description: `Volume ${dbVolume.name} mis à jour lors de la synchronisation`,
                userId: userId,
                metadata: {
                  volumeId: dbVolume.id,
                  volumeName: dbVolume.name,
                  driver: dockerVolume.Driver
                } as Prisma.JsonValue
              }
            });
          }
        }
      }
      
      // Ajouter les nouveaux volumes
      for (const dockerVolume of volumesToAdd) {
        // Vérifier si le volume appartient à l'utilisateur via les labels
        const labels = dockerVolume.Labels || {};
        const volumeUserId = labels['com.dockerflow.userId'] || '';
        
        // Si le volume a un userId spécifié et qu'il ne correspond pas à l'utilisateur actuel, on l'ignore
        if (volumeUserId && volumeUserId !== userId) {
          console.log(`[DockerVolumeSync] Volume ${dockerVolume.Name} appartient à un autre utilisateur (${volumeUserId}), ignoré`);
          continue;
        }
        
        transactions.push(
          prisma.volume.create({
            data: {
              name: dockerVolume.Name,
              driver: dockerVolume.Driver || 'local',
              mountpoint: dockerVolume.Mountpoint || '',
              size: 0, // Taille par défaut, à mettre à jour ultérieurement
              userId: userId
            }
          }).then(newVolume => {
            // Créer une activité pour le nouveau volume
            return prisma.activity.create({
              data: {
                type: ActivityType.VOLUME_CREATE,
                description: `Volume ${dockerVolume.Name} découvert et ajouté lors de la synchronisation`,
                userId: userId,
                metadata: {
                  volumeId: newVolume.id,
                  volumeName: newVolume.name,
                  driver: newVolume.driver
                } as Prisma.JsonValue
              }
            }).then(() => newVolume);
          })
        );
      }
      
      // Exécuter les transactions si nécessaire
      if (transactions.length > 0) {
        await Promise.all(transactions);
        console.log(`[DockerVolumeSync] ${transactions.length} opérations de synchronisation effectuées avec succès`);
      } else {
        console.log(`[DockerVolumeSync] Aucune opération de synchronisation nécessaire, tout est à jour`);
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
    } catch (error) {
      console.error('[DockerVolumeSync] Erreur lors de la synchronisation des volumes:', error);
      throw error;
    } finally {
      this.isSyncing = false;
      console.log(`[DockerVolumeSync] Fin de la synchronisation des volumes pour l'utilisateur ${userId}`);
    }
  }
  
  /**
   * Vérifie si un volume existe dans Docker
   * @param volumeName - Nom du volume à vérifier
   * @returns true si le volume existe, false sinon
   */
  public async checkVolumeExistsInDocker(volumeName: string): Promise<boolean> {
    try {
      const docker = await getDockerClient();
      const volumes = await docker.listVolumes();
      return volumes.Volumes.some(vol => vol.Name === volumeName);
    } catch (error) {
      console.error(`[DockerVolumeSync] Erreur lors de la vérification du volume ${volumeName} dans Docker:`, error);
      return false;
    }
  }
}

// Exporter l'instance singleton pour une utilisation facile
export const dockerVolumeSync = DockerVolumeSync.getInstance();
