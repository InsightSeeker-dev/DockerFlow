import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../../../lib/auth';
import { docker } from '../../../../../../../lib/docker';
import { isAdmin } from '../../../../../../../lib/utils/auth-helpers';
import { prisma } from '../../../../../../../lib/prisma';
import { ActivityType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { containerId: string; action: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const container = docker.getContainer(params.containerId);
    const { action } = params;

    console.log(`[CONTAINER_ACTION] Attempting to ${action} container ${params.containerId}`);

    // Vérifier que l'action est valide
    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Vérifier l'état actuel du conteneur
    const containerInfo = await container.inspect();
    console.log(`[CONTAINER_ACTION] Current container state: ${containerInfo.State.Status}`);

    // Exécuter l'action sur le conteneur
    try {
      switch (action) {
        case 'start':
          if (containerInfo.State.Status === 'running') {
            return NextResponse.json(
              { error: 'Container is already running' },
              { status: 400 }
            );
          }
          await container.start();
          break;

        case 'stop':
          if (containerInfo.State.Status === 'exited') {
            return NextResponse.json(
              { error: 'Container is already stopped' },
              { status: 400 }
            );
          }
          await container.stop();
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

          try {
            // Utiliser directement la méthode restart de Docker
            await container.restart({ t: 10 }); // 10 secondes de timeout
            console.log('[CONTAINER_RESTART] Restart command sent');
            
            // Attendre que le conteneur soit complètement redémarré
            let attempts = 0;
            const maxAttempts = 10;
            let containerRunning = false;
            
            while (attempts < maxAttempts && !containerRunning) {
              console.log(`[CONTAINER_RESTART] Checking container state (attempt ${attempts + 1}/${maxAttempts})`);
              const currentInfo = await container.inspect();
              
              if (currentInfo.State.Status === 'running' && currentInfo.State.Health?.Status === 'healthy') {
                containerRunning = true;
                console.log('[CONTAINER_RESTART] Container is now running and healthy');
              } else {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            if (!containerRunning) {
              throw new Error('Container failed to reach running state after restart');
            }
          } catch (error: any) {
            console.error('[CONTAINER_RESTART_ERROR] Failed to restart container:', error);
            throw new Error(error?.message || 'Unknown error during container restart');
          }
          break;
      }

      // Vérifier le nouvel état du conteneur
      const updatedInfo = await container.inspect();
      console.log(`[CONTAINER_ACTION] New container state: ${updatedInfo.State.Status}`);

      // Enregistrer l'activité
      if (session.user?.id) {
        await prisma.activity.create({
          data: {
            type: `CONTAINER_${action.toUpperCase()}` as ActivityType,
            description: `Container ${containerInfo.Name.replace(/^\//, '')} ${action}ed`,
            userId: session.user.id,
            metadata: {
              containerId: params.containerId,
              containerName: containerInfo.Name.replace(/^\//, ''),
              action,
              previousState: containerInfo.State.Status,
              newState: updatedInfo.State.Status
            }
          }
        });
      }

      return NextResponse.json({
        message: `Container ${action}ed successfully`,
        previousState: containerInfo.State.Status,
        newState: updatedInfo.State.Status
      });

    } catch (error) {
      console.error(`[CONTAINER_${action.toUpperCase()}_ERROR]`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action} container`;
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[CONTAINER_ACTION_ERROR] Unexpected error:`, error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
