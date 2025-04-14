import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDockerClient } from '@/lib/docker';
import { prisma } from '@/lib/prisma';
import { ActivityType } from '@prisma/client';
import { logger } from '@/lib/logger';

export async function DELETE(
  request: Request,
  { params }: { params: { name: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { name } = params;
    const docker = await getDockerClient();

    // 1. Vérifier si le volume existe dans Docker
    try {
      const volume = await docker.getVolume(name).inspect();
      
      // 2. Vérifier si le volume appartient à l'utilisateur
      if (volume.Labels?.['com.dockerflow.userId'] !== session.user.id) {
        return NextResponse.json(
          { error: 'Unauthorized - Volume does not belong to user' },
          { status: 403 }
        );
      }

      // 3. Vérifier si le volume est utilisé par des conteneurs
      const containers = await docker.listContainers({ all: true });
      const usedBy = containers.filter(container => {
        return container.Mounts?.some(mount => 
          mount.Type === 'volume' && mount.Name === name
        );
      });

      if (usedBy.length > 0) {
        return NextResponse.json({
          error: 'Volume is in use',
          containers: usedBy.map(c => c.Names[0].replace('/', ''))
        }, { status: 400 });
      }

      // 4. Supprimer le volume de Docker
      await docker.getVolume(name).remove();

      // 5. Supprimer le volume de la base de données
      await prisma.volume.updateMany({
        where: { 
          name,
          userId: session.user.id,
          deletedAt: null
        },
        data: { deletedAt: new Date() }
      });

      // 6. Enregistrer l'activité
      await prisma.activity.create({
        data: {
          type: ActivityType.VOLUME_DELETE,
          description: `Volume ${name} deleted`,
          userId: session.user.id,
          metadata: {
            volumeName: name
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: `Volume ${name} successfully deleted`
      });
    } catch (error) {
      logger.error('Error in volume deletion:', error);
      return NextResponse.json(
        { error: 'Failed to delete volume', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Unexpected error in volume deletion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
