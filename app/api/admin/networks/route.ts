import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

export const dynamic = 'force-dynamic';

// GET /api/admin/networks
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const networks = await docker.listNetworks();
    const detailedNetworks = await Promise.all(
      networks.map(async (network) => {
        const networkDetails = await docker.getNetwork(network.Id).inspect();
        
        // Formater les conteneurs connectés
        const containers = Object.entries(networkDetails.Containers || {}).map(
          ([id, info]: [string, any]) => ({
            id,
            name: info.Name,
            ipv4Address: info.IPv4Address,
            ipv6Address: info.IPv6Address,
          })
        );

        return {
          id: networkDetails.Id,
          name: networkDetails.Name,
          driver: networkDetails.Driver,
          scope: networkDetails.Scope,
          internal: networkDetails.Internal,
          ipam: networkDetails.IPAM,
          containers,
          options: networkDetails.Options || {},
        };
      })
    );

    return NextResponse.json(detailedNetworks);
  } catch (error) {
    console.error('Error fetching networks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch networks' },
      { status: 500 }
    );
  }
}

// POST /api/admin/networks
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, driver, internal, subnet, gateway, options } = await request.json();

    // Valider les paramètres requis
    if (!name) {
      return NextResponse.json(
        { error: 'Network name is required' },
        { status: 400 }
      );
    }

    // Configurer les options du réseau
    const networkConfig: Docker.NetworkCreateOptions = {
      Name: name,
      Driver: driver || 'bridge',
      Internal: internal || false,
      Options: options || {},
      IPAM: {
        Driver: 'default',
        Config: [],
      },
    };

    // Ajouter la configuration IPAM si subnet est spécifié
    if (subnet) {
      const ipamConfig: any = { Subnet: subnet };
      if (gateway) {
        ipamConfig.Gateway = gateway;
      }
      networkConfig.IPAM!.Config = [ipamConfig];
    }

    // Créer le réseau
    await docker.createNetwork(networkConfig);

    return NextResponse.json({ message: 'Network created successfully' });
  } catch (error) {
    console.error('Error creating network:', error);
    return NextResponse.json(
      { error: 'Failed to create network' },
      { status: 500 }
    );
  }
}
