import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Mount } from '@/lib/docker/types';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !['start', 'stop', 'restart', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Récupérer le conteneur Docker
    const docker = getDockerClient();
    const dockerContainer = docker.getContainer(params.id);

    // Vérifier que le conteneur existe et que l'utilisateur a les droits
    try {
      const containerInfo = await dockerContainer.inspect();
      
      // Vérifier que l'utilisateur a accès au conteneur
      const dbContainer = await prisma.container.findFirst({
        where: {
          name: containerInfo.Name.replace(/^\//, ''),
          OR: [
            { userId: session.user.id },
            { user: { role: 'ADMIN' } }
          ]
        }
      });

      if (!dbContainer && session.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Exécuter l'action demandée
      switch (action) {
        case 'start':
          await dockerContainer.start();
          break;
        case 'stop':
          await dockerContainer.stop();
          break;
        case 'restart':
          await dockerContainer.restart();
          break;
        case 'remove':
          // Récupérer les informations du conteneur pour identifier les volumes
          const containerInfo = await dockerContainer.inspect();
          
          // Supprimer le conteneur avec l'option v pour supprimer les volumes
          await dockerContainer.remove({ 
            force: true,  // Force la suppression même si le conteneur est en cours d'exécution
            v: true       // Supprime les volumes anonymes associés
          });

          // Supprimer les volumes nommés si présents
          if (containerInfo.Mounts) {
            const docker = getDockerClient();
            for (const mount of containerInfo.Mounts as Mount[]) {
              if (mount.Type === 'volume' && mount.Name) {
                try {
                  const volume = docker.getVolume(mount.Name);
                  await volume.remove();
                } catch (error) {
                  console.error(`Failed to remove volume ${mount.Name}:`, error);
                }
              }
            }
          }

          // Supprimer l'entrée de la base de données
          if (dbContainer) {
            await prisma.container.delete({
              where: { id: dbContainer.id }
            });
          }
          break;
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`Error performing action ${action}:`, error);
      return NextResponse.json(
        { error: `Failed to ${action} container` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in container action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
