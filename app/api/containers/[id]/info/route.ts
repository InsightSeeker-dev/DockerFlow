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

    // Récupérer le conteneur Docker
    const docker = getDockerClient();
    const dockerContainer = docker.getContainer(params.id);

    // Vérifier que le conteneur existe et que l'utilisateur a les droits
    try {
      const containerInfo = await dockerContainer.inspect();
      
      // Vérifier que l'utilisateur a accès au conteneur
      // 1. Recherche par name
      let dbContainer = await prisma.container.findFirst({
        where: {
          name: containerInfo.Name.replace(/^\//, ''),
          OR: [
            { userId: session.user.id },
            { user: { role: 'ADMIN' } }
          ]
        }
      });
      // 2. Si non trouvé et containerInfo.Id existe, recherche par dockerId
      if (!dbContainer && containerInfo.Id) {
        dbContainer = await prisma.container.findFirst({
          where: {
            dockerId: containerInfo.Id,
            OR: [
              { userId: session.user.id },
              { user: { role: 'ADMIN' } }
            ]
          }
        });
      }

      if (!dbContainer && session.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      // Trouver le port web exposé (port 80 ou 443 mappé)
      let webPort = null;
      if (containerInfo.NetworkSettings?.Ports) {
        const ports = containerInfo.NetworkSettings.Ports;
        for (const portMapping of Object.entries(ports)) {
          const [containerPort, hostBindings] = portMapping;
          if (
            (containerPort.startsWith('80/') || containerPort.startsWith('443/')) &&
            hostBindings && 
            hostBindings.length > 0
          ) {
            webPort = hostBindings[0].HostPort;
            break;
          }
        }
      }

      return NextResponse.json({
        ...containerInfo,
        WebPort: webPort
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Container not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error getting container info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
