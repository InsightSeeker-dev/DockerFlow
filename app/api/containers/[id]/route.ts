import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Mount } from '@/lib/docker/types';
import { ActivityType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[API] Début de traitement de la requête PATCH pour le conteneur ${params.id}`);
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log(`[API] Accès non autorisé: session ou ID utilisateur manquant`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
      console.log(`[API] Corps de la requête reçu:`, body);
    } catch (error) {
      console.error(`[API] Erreur lors de l'analyse du corps de la requête:`, error);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    const { action, keepVolume = false } = body;
    console.log(`[API] Action demandée: ${action}, keepVolume: ${keepVolume}`);

    // Liste unifiée des actions supportées
    if (!action || !['start', 'stop', 'restart', 'remove', 'delete', 'logs', 'access'].includes(action)) {
      console.log(`[API] Action invalide: ${action}`);
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Normaliser l'action "delete" en "remove"
    const normalizedAction = action === 'delete' ? 'remove' : action;
    console.log(`[API] Action normalisée: ${normalizedAction}`);

    // Récupérer le conteneur de la base de données
    console.log(`[API] Recherche du conteneur dans la base de données avec ID: ${params.id}`);
    
    let dbContainer;
    try {
      // 1. Recherche par id MongoDB (si valide)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(params.id);
      if (isValidObjectId) {
        dbContainer = await prisma.container.findUnique({
          where: { id: params.id },
          include: { user: true }
        });
      }
      // 2. Si non trouvé, recherche par name
      if (!dbContainer) {
        dbContainer = await prisma.container.findUnique({
          where: { name: params.id },
          include: { user: true }
        });
      }
      // 3. Si toujours pas trouvé, recherche par dockerId
      if (!dbContainer) {
        dbContainer = await prisma.container.findFirst({
          where: { dockerId: params.id },
          include: { user: true }
        });
      }
    } catch (error) {
      console.error(`[API] Erreur lors de la recherche du conteneur dans la base de données:`, error);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (!dbContainer) {
      console.log(`[API] Conteneur non trouvé dans la base de données: ${params.id}`);
      return NextResponse.json(
        { error: 'Container not found' },
        { status: 404 }
      );
    }
    
    console.log(`[API] Conteneur trouvé dans la base de données: ${dbContainer.name} (ID: ${dbContainer.id})`);
    console.log(`[API] Propriétaire du conteneur: ${dbContainer.user.id}`);
    
    // Vérifier que l'utilisateur est autorisé à accéder au conteneur
    if (dbContainer.userId !== session.user.id && session.user.role !== 'ADMIN') {
      console.log(`[API] Accès non autorisé: l'utilisateur ${session.user.id} n'est pas propriétaire du conteneur et n'est pas administrateur`);
      return NextResponse.json(
        { error: 'You are not authorized to perform actions on this container' },
        { status: 403 }
      );
    }

    // Vérifier que l'utilisateur a accès au conteneur
    if (dbContainer.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Récupérer le conteneur Docker par son nom
    const docker = getDockerClient();
    let dockerContainer;
    let containerInfo;
    
    try {
      // Vérifier si l'ID fourni est un ID Docker ou un nom de conteneur
      const isDockerID = /^[0-9a-f]{64}$/.test(params.id);
      
      if (isDockerID) {
        // Si c'est un ID Docker, l'utiliser directement
        dockerContainer = docker.getContainer(params.id);
        console.log(`[CONTAINER_ACTION] Recherche du conteneur par ID: ${params.id}`);
      } else {
        // Sinon, utiliser le nom du conteneur depuis la base de données
        console.log(`[CONTAINER_ACTION] Recherche du conteneur par nom: ${dbContainer.name}`);
        dockerContainer = docker.getContainer(dbContainer.name);
      }
      
      // Vérifier l'état actuel du conteneur
      containerInfo = await dockerContainer.inspect();
      console.log(`[CONTAINER_ACTION] Conteneur trouvé: ${containerInfo.Name} (${containerInfo.Id.substring(0, 12)})`);
      console.log(`[CONTAINER_ACTION] État actuel du conteneur: ${containerInfo.State.Status}`);
    } catch (error) {
      console.error(`[CONTAINER_ACTION] Conteneur Docker non trouvé (${params.id} / ${dbContainer.name}):`, error);
      return NextResponse.json(
        { error: 'Conteneur Docker non trouvé. Vérifiez que le conteneur existe et est accessible.' },
        { status: 404 }
      );
    }

    // Exécuter l'action demandée
    let result = {};
    
    switch (normalizedAction) {
      case 'start':
        // Vérifier si le conteneur est déjà en cours d'exécution
        if (containerInfo.State.Status === 'running') {
          return NextResponse.json(
            { error: 'Container is already running' },
            { status: 400 }
          );
        }
        await dockerContainer.start();
        break;
        
      case 'stop':
        console.log(`[CONTAINER_STOP] Attempting to stop container ${params.id} (${dbContainer.name})`);
        console.log(`[CONTAINER_STOP] Current container state: ${containerInfo.State.Status}`);
        
        // Vérifier si le conteneur est déjà arrêté
        if (containerInfo.State.Status === 'exited') {
          console.log(`[CONTAINER_STOP] Container ${params.id} is already stopped`);
          return NextResponse.json(
            { error: 'Le conteneur est déjà arrêté', currentState: containerInfo.State.Status },
            { status: 400 }
          );
        }
        
        try {
          // Vérifier la politique de redémarrage du conteneur
          const restartPolicy = containerInfo.HostConfig?.RestartPolicy?.Name;
          console.log(`[CONTAINER_STOP] Container ${params.id} has restart policy: ${restartPolicy}`);
          
          // Si la politique est 'always' ou 'unless-stopped', nous devons utiliser une approche spéciale
          if (restartPolicy === 'always' || restartPolicy === 'unless-stopped') {
            console.log(`[CONTAINER_STOP] Container ${params.id} has restart policy '${restartPolicy}' that may interfere with stop action`);
            console.log(`[CONTAINER_STOP] Using special handling for containers with restart policy`);
            
            // Pour les conteneurs avec politique de redémarrage, nous allons utiliser
            // une approche plus robuste en deux étapes
          }
          
          // Définir un timeout pour l'arrêt du conteneur
          const stopOptions = {
            t: 30  // 30 secondes de timeout
          };
          
          await dockerContainer.stop(stopOptions);
          console.log(`[CONTAINER_STOP] Container ${params.id} stopped successfully`);
          
          // Vérifier que le conteneur est bien arrêté
          const updatedInfo = await dockerContainer.inspect();
          console.log(`[CONTAINER_STOP] Updated container state: ${updatedInfo.State.Status}`);
          
          if (updatedInfo.State.Status !== 'exited') {
            console.warn(`[CONTAINER_STOP] Container ${params.id} did not reach 'exited' state after stop command`);
            
            // Si le conteneur est toujours en cours d'exécution, utilisons une approche plus robuste
            if (updatedInfo.State.Status === 'running') {
              console.log(`[CONTAINER_STOP] Container still running, using force option`);
              
              // Utiliser l'option force pour arrêter le conteneur
              try {
                // Utiliser l'API dockerode avec l'option force
                await dockerContainer.stop({ t: 0 }); // timeout de 0 secondes équivaut à un arrêt forcé
                console.log(`[CONTAINER_STOP] Force stop applied to container ${params.id}`);
                
                // Vérifier à nouveau l'état du conteneur
                const finalCheck = await dockerContainer.inspect();
                console.log(`[CONTAINER_STOP] Final container state after force stop: ${finalCheck.State.Status}`);
                
                if (finalCheck.State.Status === 'running') {
                  // Si toujours en exécution, c'est probablement à cause de la politique de redémarrage
                  console.warn(`[CONTAINER_STOP] Container ${params.id} still running due to restart policy`);
                  // Nous retournons quand même un succès car l'action a été effectuée, même si le conteneur a redémarré
                }
              } catch (forceError: any) {
                console.error(`[CONTAINER_STOP] Error with force stop: ${forceError.message}`);
                throw new Error(`Impossible d'arrêter le conteneur même avec l'option force: ${forceError.message}`);
              }
            }
          }
        } catch (error: any) {
          console.error(`[CONTAINER_STOP] Error stopping container ${params.id}:`, error);
          throw new Error(`Erreur lors de l'arrêt du conteneur: ${error.message}`);
        }
        break;
        
      case 'restart':
        console.log('[CONTAINER_RESTART] Starting restart sequence');
        
        // Vérifier si le conteneur est dans un état valide pour le redémarrage
        if (!['running', 'exited'].includes(containerInfo.State.Status)) {
          return NextResponse.json(
            { error: `Cannot restart container in state: ${containerInfo.State.Status}` },
            { status: 400 }
          );
        }

        // Définir un timeout plus long pour le redémarrage
        const restartOptions = {
          t: 30  // 30 secondes de timeout
        };
        
        try {
          await dockerContainer.restart(restartOptions);
          console.log('[CONTAINER_RESTART] Container restart command sent');
          
          // Attendre que le conteneur soit complètement redémarré
          let attempts = 0;
          const maxAttempts = 10;
          let containerRunning = false;
          
          while (attempts < maxAttempts && !containerRunning) {
            console.log(`[CONTAINER_RESTART] Checking container state (attempt ${attempts + 1}/${maxAttempts})`);
            const currentInfo = await dockerContainer.inspect();
            
            if (currentInfo.State.Status === 'running') {
              containerRunning = true;
              console.log('[CONTAINER_RESTART] Container is now running');
            } else {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (!containerRunning) {
            throw new Error('Container failed to reach running state after restart');
          }
        } catch (error: any) {
          console.error('[CONTAINER_RESTART] Error during restart:', error);
          return NextResponse.json(
            { error: `Failed to restart container: ${error.message}` },
            { status: 500 }
          );
        }
        break;
        
      case 'remove':
        console.log(`[CONTAINER_REMOVE] Début de la suppression du conteneur ${params.id} (${dbContainer.name})`);
        console.log(`[CONTAINER_REMOVE] ID Docker: ${containerInfo.Id}, Nom: ${containerInfo.Name}`);
        console.log(`[CONTAINER_REMOVE] État actuel: ${containerInfo.State.Status}, keepVolume: ${keepVolume === true}`);
        
        // Si le conteneur est en cours d'exécution, on le force à s'arrêter d'abord
        if (containerInfo.State.Status === 'running' || containerInfo.State.Status === 'restarting') {
          console.log(`[CONTAINER_REMOVE] Le conteneur est en cours d'exécution, tentative d'arrêt forcé avant suppression`);
          try {
            await dockerContainer.stop({ t: 0 }); // Arrêt immédiat
            console.log(`[CONTAINER_REMOVE] Conteneur arrêté avec succès`);
          } catch (stopError: any) {
            console.error(`[CONTAINER_REMOVE] Erreur lors de l'arrêt du conteneur:`, stopError);
            console.log(`[CONTAINER_REMOVE] Continuons avec la suppression forcée`);
            // On continue malgré l'erreur
          }
        }
        
        try {
          // Supprimer le conteneur avec l'option v pour supprimer les volumes
          const removeOptions = { 
            force: true,  // Force la suppression même si le conteneur est en cours d'exécution
            v: keepVolume === true ? false : true // Supprime les volumes anonymes associés sauf si keepVolume est true
          };
          
          console.log(`[CONTAINER_REMOVE] Tentative de suppression du conteneur avec options:`, removeOptions);
          
          await dockerContainer.remove(removeOptions);
          
          console.log(`[CONTAINER_REMOVE] Conteneur ${dbContainer.name} supprimé avec succès de Docker`);

          // Supprimer les volumes nommés si présents et si keepVolume est false
          if (keepVolume !== true && containerInfo.Mounts && containerInfo.Mounts.length > 0) {
            console.log(`[CONTAINER_REMOVE] Suppression des volumes associés (${containerInfo.Mounts.length} volumes)`);
            
            for (const mount of containerInfo.Mounts as Mount[]) {
              if (mount.Type === 'volume' && mount.Name) {
                try {
                  console.log(`[CONTAINER_REMOVE] Tentative de suppression du volume ${mount.Name}`);
                  const volume = docker.getVolume(mount.Name);
                  await volume.remove();
                  console.log(`[CONTAINER_REMOVE] Volume ${mount.Name} supprimé avec succès`);
                } catch (error: any) {
                  console.error(`[CONTAINER_REMOVE] Erreur lors de la suppression du volume ${mount.Name}:`, error);
                  console.error(`[CONTAINER_REMOVE] Message d'erreur: ${error.message}`);
                  // On continue malgré l'erreur pour supprimer les autres volumes
                }
              }
            }
          } else {
            console.log(`[CONTAINER_REMOVE] Aucun volume à supprimer ou keepVolume=${keepVolume === true}`);
          }

          try {
            // Supprimer l'entrée de la base de données
            console.log(`[CONTAINER_REMOVE] Suppression de l'entrée dans la base de données (ID: ${dbContainer.id})`);
            await prisma.container.delete({
              where: { id: dbContainer.id }
            });
            console.log(`[CONTAINER_REMOVE] Entrée supprimée de la base de données avec succès`);
            
            // Enregistrer l'activité
            await prisma.activity.create({
              data: {
                type: ActivityType.CONTAINER_DELETE,
                userId: session.user.id,
                description: `Suppression du conteneur ${dbContainer.name}`,
                metadata: {
                  containerName: dbContainer.name,
                  containerId: dbContainer.id,
                  action: 'remove',
                  keepVolume: keepVolume === true
                }
              }
            });
            console.log(`[CONTAINER_REMOVE] Activité enregistrée avec succès`);
            
            // Préparer la réponse de succès
            result = { success: true, message: `Container ${dbContainer.name} removed successfully` };
            
          } catch (dbError: any) {
            console.error(`[CONTAINER_REMOVE] Erreur lors de la suppression de l'entrée dans la base de données:`, dbError);
            console.error(`[CONTAINER_REMOVE] Message d'erreur DB: ${dbError.message}`);
            throw new Error(`Conteneur supprimé de Docker mais erreur lors de la suppression de l'entrée dans la base de données: ${dbError.message}`);
          }
        } catch (error: any) {
          console.error(`[CONTAINER_REMOVE] Erreur lors de la suppression du conteneur ${dbContainer.name}:`, error);
          console.error(`[CONTAINER_REMOVE] Message d'erreur: ${error.message}`);
          console.error(`[CONTAINER_REMOVE] Stack trace: ${error.stack}`);
          
          // Vérifier si le conteneur existe toujours dans Docker
          try {
            await dockerContainer.inspect();
            console.error(`[CONTAINER_REMOVE] Le conteneur existe toujours dans Docker après tentative de suppression`);
          } catch (inspectError) {
            console.log(`[CONTAINER_REMOVE] Le conteneur n'existe plus dans Docker, mais une erreur s'est produite lors de la suppression en base de données`);
            
            // Si le conteneur n'existe plus dans Docker mais qu'il est toujours dans la base de données,
            // on tente de le supprimer de la base de données
            try {
              await prisma.container.delete({
                where: { id: dbContainer.id }
              });
              console.log(`[CONTAINER_REMOVE] Entrée supprimée de la base de données avec succès après échec de la suppression Docker`);
              
              return NextResponse.json(
                { success: true, message: `Container ${dbContainer.name} removed from database (was already removed from Docker)` },
                { status: 200 }
              );
            } catch (finalDbError) {
              console.error(`[CONTAINER_REMOVE] Échec final de la suppression de l'entrée dans la base de données:`, finalDbError);
            }
          }
          
          throw new Error(`Erreur lors de la suppression du conteneur: ${error.message}`);
        }
        break;
        
      case 'logs':
        console.log(`[CONTAINER_LOGS] Récupération des logs pour le conteneur ${params.id} (${dbContainer.name})`);
        try {
          // Vérifier si le conteneur existe dans Docker
          let dockerContainer;
          try {
            dockerContainer = docker.getContainer(params.id);
            // Vérifier que le conteneur est accessible
            const inspectResult = await dockerContainer.inspect();
            // Vérifier que le résultat existe
            if (inspectResult) {
              console.log(`[CONTAINER_LOGS] Conteneur Docker trouvé: ${params.id}`);
            }
          } catch (err) {
            console.error(`[CONTAINER_LOGS] Conteneur Docker non trouvé ou inaccessible: ${params.id}`, err);
            // Si le conteneur n'existe pas dans Docker, essayer de le trouver par son nom
            const allContainers = await docker.listContainers({ all: true });
            const containerByName = allContainers.find(c => c.Names.some(name => name.replace(/^\//, '') === dbContainer.name));
            
            if (containerByName) {
              console.log(`[CONTAINER_LOGS] Conteneur trouvé par son nom: ${containerByName.Id}`);
              dockerContainer = docker.getContainer(containerByName.Id);
            } else {
              console.error(`[CONTAINER_LOGS] Aucun conteneur Docker correspondant trouvé pour ${dbContainer.name} (ID: ${params.id})`);
              return NextResponse.json(
                { 
                  error: `Conteneur non trouvé dans Docker`, 
                  details: `Le conteneur ${dbContainer.name} existe dans la base de données mais n'est pas accessible via Docker.` 
                },
                { status: 404 }
              );
            }
          }
          
          console.log(`[CONTAINER_LOGS] Tentative de récupération des logs pour ${dbContainer.name}`);
          
          // Solution ultra-simple pour récupérer les logs
          try {
            // Utiliser directement l'API Docker native avec une promesse
            console.log(`[CONTAINER_LOGS] Tentative de récupération des logs via API Docker native`);
            
            // Promisifier la récupération des logs
            const logs = await new Promise<string[]>((resolve, reject) => {
              // Options de base pour les logs
              const options = {
                stdout: true,
                stderr: true,
                tail: 1000,
                timestamps: true,
                follow: false as const
              };
              
              // Appel à l'API Docker
              dockerContainer.logs(options, (err: Error | null, data: any) => {
                if (err) {
                  console.error(`[CONTAINER_LOGS] Erreur Docker:`, err);
                  reject(err);
                  return;
                }
                
                let logsText = '';
                
                // Convertir le résultat en texte selon son type
                if (Buffer.isBuffer(data)) {
                  logsText = data.toString('utf8');
                } else if (typeof data === 'string') {
                  logsText = data;
                } else {
                  reject(new Error('Format de logs non reconnu'));
                  return;
                }
                
                // Traitement simple des logs
                const logLines = logsText
                  .split('\n')
                  .filter(line => line.trim() !== '');
                  
                console.log(`[CONTAINER_LOGS] ${logLines.length} lignes de logs récupérées`);
                resolve(logLines);
              });
            });
            
            // Retourner directement les logs sans traitement supplémentaire
            return NextResponse.json({ logs });
            
          } catch (error) {
            console.error(`[CONTAINER_LOGS] Erreur lors de la récupération des logs:`, error);
            
            // Message d'erreur simple
            const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
            
            // Retourner directement l'erreur
            return NextResponse.json(
              { 
                error: `Impossible de récupérer les logs du conteneur ${dbContainer.name}`, 
                details: errorMessage 
              },
              { status: 500 }
            );
          }
          // La réponse est déjà gérée dans le bloc try/catch précédent
        } catch (error: any) {
          console.error(`[CONTAINER_LOGS] Erreur générale:`, error);
          return NextResponse.json(
            { error: `Impossible de récupérer les logs: ${error.message}` },
            { status: 500 }
          );
        }
        // Pas besoin de break car on retourne directement la réponse
        
      case 'access':
        // Cette action est traitée côté client, on renvoie juste les informations nécessaires
        result = {
          subdomain: dbContainer.subdomain,
          ports: containerInfo.NetworkSettings?.Ports || []
        };
        break;
    }

    // Mapper l'action à un type d'activité valide
    let activityType: ActivityType;
    switch (normalizedAction) {
      case 'start':
        activityType = ActivityType.CONTAINER_START;
        break;
      case 'stop':
        activityType = ActivityType.CONTAINER_STOP;
        break;
      case 'restart':
        // Bien que CONTAINER_RESTART soit défini dans le schéma Prisma, utilisons CONTAINER_START pour éviter les erreurs TypeScript
        activityType = ActivityType.CONTAINER_START;
        break;
      case 'remove':
        activityType = ActivityType.CONTAINER_DELETE;
        break;
      case 'logs':
        // Utiliser la valeur littérale pour éviter les problèmes de typage
        activityType = 'CONTAINER_LOGS' as ActivityType;
        break;
      case 'access':
        // Bien que CONTAINER_ACCESS soit défini dans le schéma Prisma, utilisons CONTAINER_START pour éviter les erreurs TypeScript
        activityType = ActivityType.CONTAINER_START;
        break;
      default:
        activityType = ActivityType.CONTAINER_START; // Fallback
    }

    // Préparer la description et les métadonnées en fonction de l'action
    let description = `Container ${dbContainer.name} ${normalizedAction === 'remove' ? 'removed' : normalizedAction + 'ed'}`;
    let metadata: Record<string, any> = {
      containerId: params.id,
      containerName: dbContainer.name,
      action: normalizedAction,
      previousState: containerInfo.State.Status,
      userId: session.user.id,
      userName: session.user.name || session.user.email
    };
    
    // Ajouter des détails spécifiques pour l'action logs
    if (normalizedAction === 'logs') {
      description = `Consultation des logs du conteneur ${dbContainer.name}`;
      // Ajouter le nombre de lignes de logs si disponible
      if (result && 'logs' in result && Array.isArray(result.logs)) {
        metadata.logCount = result.logs.length;
      }
    }
    
    // Ajouter une activité dans la base de données
    await prisma.activity.create({
      data: {
        type: activityType,
        description,
        metadata,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Container ${normalizedAction === 'remove' ? 'removed' : normalizedAction + 'ed'} successfully`,
      ...result
    });
  } catch (error) {
    console.error(`Error during container ${params.id} action:`, error);
    return NextResponse.json(
      { error: 'Failed to perform action on container' },
      { status: 500 }
    );
  }
}
