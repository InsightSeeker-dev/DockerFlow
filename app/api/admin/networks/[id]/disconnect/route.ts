import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

// POST /api/admin/networks/[id]/disconnect
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { containerId, force } = await request.json();
    if (!containerId) {
      return NextResponse.json(
        { error: 'Container ID is required' },
        { status: 400 }
      );
    }

    const network = docker.getNetwork(params.id);

    // Vérifier si le réseau existe
    try {
      const networkInfo = await network.inspect();
      
      // Vérifier si le conteneur est connecté au réseau
      if (!networkInfo.Containers?.[containerId]) {
        return NextResponse.json(
          { error: 'Container is not connected to this network' },
          { status: 400 }
        );
      }

      // Vérifier si c'est le dernier réseau du conteneur
      const container = docker.getContainer(containerId);
      const containerInfo = await container.inspect();
      const connectedNetworks = Object.keys(containerInfo.NetworkSettings.Networks);
      
      if (connectedNetworks.length === 1 && !force) {
        return NextResponse.json(
          { error: 'Cannot disconnect the last network of a container without force option' },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Network or container not found' },
        { status: 404 }
      );
    }

    // Déconnecter le conteneur
    await network.disconnect({
      Container: containerId,
      Force: force || false,
    });

    return NextResponse.json({ message: 'Container disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting container from network:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect container from network' },
      { status: 500 }
    );
  }
}
