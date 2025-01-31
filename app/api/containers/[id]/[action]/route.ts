import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ActivityType } from '@prisma/client';

export async function POST(
  request: Request,
  { params }: { params: { id: string; action: string } }
) {
  try {
    // Vérifier l'authentification
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Vérifier que l'utilisateur a accès au conteneur
    const userContainer = await prisma.container.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!userContainer) {
      return new NextResponse('Container not found or access denied', { status: 404 });
    }

    const docker = getDockerClient();
    const container = docker.getContainer(params.id);

    // Vérifier si le conteneur existe dans Docker
    try {
      await container.inspect();
    } catch (error) {
      console.error('Container inspect error:', error);
      return NextResponse.json(
        { error: 'Container not found in Docker' },
        { status: 404 }
      );
    }

    switch (params.action) {
      case 'start':
        await container.start();
        break;
      case 'stop':
        await container.stop();
        break;
      case 'restart':
        await container.restart();
        break;
      case 'delete':
      case 'remove':
        await container.remove({ force: true });
        // Supprimer également de la base de données
        await prisma.container.delete({
          where: { id: params.id }
        });
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Mapper l'action à un type d'activité valide
    let activityType: ActivityType;
    switch (params.action) {
      case 'start':
        activityType = ActivityType.CONTAINER_START;
        break;
      case 'stop':
        activityType = ActivityType.CONTAINER_STOP;
        break;
      case 'delete':
      case 'remove':
        activityType = ActivityType.CONTAINER_DELETE;
        break;
      default:
        activityType = ActivityType.CONTAINER_START; // Fallback pour restart
    }

    // Ajouter une activité dans la base de données
    await prisma.activity.create({
      data: {
        type: activityType,
        description: `Container ${userContainer.name} ${params.action}ed`,
        metadata: {
          containerId: params.id,
          containerName: userContainer.name,
          action: params.action,
        },
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Container ${params.action} successful`
    });
  } catch (error) {
    console.error(`Container ${params.action} error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Failed to ${params.action} container` },
      { status: 500 }
    );
  }
}