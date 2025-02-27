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
    const { action, keepVolume } = body;

    if (!action || !['start', 'stop', 'restart', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Récupérer le conteneur de la base de données
    const dbContainer = await prisma.container.findUnique({
      where: { id: params.id },
      include: { user: true }
    });

    if (!dbContainer) {
      return NextResponse.json(
        { error: 'Container not found' },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur a accès au conteneur
    if (dbContainer.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Récupérer le conteneur Docker
    const docker = getDockerClient();
    const dockerContainer = docker.getContainer(dbContainer.name);

    try {
      await dockerContainer.inspect();
    } catch (error) {
      console.error('Docker container not found:', error);
      return NextResponse.json(
        { error: 'Docker container not found' },
        { status: 404 }
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
          v: !keepVolume // Supprime les volumes anonymes associés sauf si keepVolume est true
        });

        // Supprimer les volumes nommés si présents et si keepVolume est false
        if (!keepVolume && containerInfo.Mounts) {
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
        await prisma.container.delete({
          where: { id: dbContainer.id }
        });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error performing container action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
