import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
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

    // Récupérer le conteneur Docker directement
    const docker = getDockerClient();
    const dockerContainer = docker.getContainer(params.id);

    // Vérifier que le conteneur existe
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
    } catch (error) {
      return NextResponse.json(
        { error: 'Container not found' },
        { status: 404 }
      );
    }

    // Récupérer les logs
    const logStream = await dockerContainer.logs({
      stdout: true,
      stderr: true,
      tail: 1000,
      timestamps: true,
      follow: false
    });

    // Convertir le stream en tableau de lignes
    const logs = logStream
      .toString('utf-8')
      .split('\n')
      .filter(Boolean)
      .map(line => {
        // Enlever les caractères de contrôle Docker
        const cleanLine = line.slice(8);
        return cleanLine;
      });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching container logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch container logs' },
      { status: 500 }
    );
  }
}