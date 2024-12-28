import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const docker = getDockerClient();
    
    // Récupérer tous les conteneurs (même ceux qui ne sont pas en cours d'exécution)
    const containers = await docker.listContainers({ all: true });
    
    // Vérifier si l'image est utilisée par des conteneurs
    const hasContainers = containers.some(container => {
      // L'ID de l'image dans le conteneur peut avoir le préfixe "sha256:"
      const containerImageId = container.ImageID.replace('sha256:', '');
      return containerImageId === params.id;
    });

    return NextResponse.json({ hasContainers });
  } catch (error) {
    console.error('Error checking containers:', error);
    return NextResponse.json(
      { error: 'Failed to check containers' },
      { status: 500 }
    );
  }
}
