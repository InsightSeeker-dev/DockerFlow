import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

// POST /api/admin/networks/[id]/connect
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { containerId, ipv4Address, ipv6Address, aliases } = await request.json();
    if (!containerId) {
      return NextResponse.json(
        { error: 'Container ID is required' },
        { status: 400 }
      );
    }

    const network = docker.getNetwork(params.id);

    // Vérifier si le conteneur existe
    try {
      await docker.getContainer(containerId).inspect();
    } catch (error) {
      return NextResponse.json(
        { error: 'Container not found' },
        { status: 404 }
      );
    }

    // Configurer les options de connexion
    const connectConfig: Docker.NetworkConnectOptions = {
      Container: containerId,
      EndpointConfig: {
        IPAMConfig: {},
      },
    };

    // Ajouter les configurations optionnelles
    if (ipv4Address) {
      connectConfig.EndpointConfig!.IPAMConfig!.IPv4Address = ipv4Address;
    }
    if (ipv6Address) {
      connectConfig.EndpointConfig!.IPAMConfig!.IPv6Address = ipv6Address;
    }
    if (aliases) {
      connectConfig.EndpointConfig!.Aliases = aliases;
    }

    await network.connect(connectConfig);

    return NextResponse.json({ message: 'Container connected successfully' });
  } catch (error) {
    console.error('Error connecting container to network:', error);
    return NextResponse.json(
      { error: 'Failed to connect container to network' },
      { status: 500 }
    );
  }
}
