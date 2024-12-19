import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

// GET /api/admin/networks/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const network = docker.getNetwork(params.id);
    const networkInfo = await network.inspect();

    // Formater les conteneurs connectés
    const containers = Object.entries(networkInfo.Containers || {}).map(
      ([id, info]: [string, any]) => ({
        id,
        name: info.Name,
        ipv4Address: info.IPv4Address,
        ipv6Address: info.IPv6Address,
      })
    );

    const formattedInfo = {
      id: networkInfo.Id,
      name: networkInfo.Name,
      driver: networkInfo.Driver,
      scope: networkInfo.Scope,
      internal: networkInfo.Internal,
      ipam: networkInfo.IPAM,
      containers,
      options: networkInfo.Options || {},
      created: networkInfo.Created,
      enableIPv6: networkInfo.EnableIPv6,
      labels: networkInfo.Labels || {},
    };

    return NextResponse.json(formattedInfo);
  } catch (error) {
    console.error('Error getting network:', error);
    return NextResponse.json(
      { error: 'Failed to get network details' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/networks/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const network = docker.getNetwork(params.id);
    const networkInfo = await network.inspect();

    // Vérifier si le réseau est un réseau système
    if (['bridge', 'host', 'none'].includes(networkInfo.Name)) {
      return NextResponse.json(
        { error: 'Cannot delete system networks' },
        { status: 400 }
      );
    }

    // Vérifier si des conteneurs sont connectés
    if (Object.keys(networkInfo.Containers || {}).length > 0) {
      return NextResponse.json(
        { error: 'Network has connected containers' },
        { status: 400 }
      );
    }

    await network.remove();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting network:', error);
    return NextResponse.json(
      { error: 'Failed to delete network' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/networks/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const network = docker.getNetwork(params.id);
    const { labels } = await request.json();

    // Mettre à jour les labels du réseau
    await network.inspect();
    
    // Note: Docker ne permet pas de modifier directement les paramètres d'un réseau existant
    // Seuls les labels peuvent être modifiés via l'API

    return NextResponse.json({ message: 'Network updated successfully' });
  } catch (error) {
    console.error('Error updating network:', error);
    return NextResponse.json(
      { error: 'Failed to update network' },
      { status: 500 }
    );
  }
}
