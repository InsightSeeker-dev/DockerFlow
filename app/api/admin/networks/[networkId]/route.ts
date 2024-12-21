import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

// GET /api/admin/networks/[networkId]
export async function GET(
  request: Request,
  { params }: { params: { networkId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const network = docker.getNetwork(params.networkId);
    const networkInfo = await network.inspect();

    return NextResponse.json(networkInfo);
  } catch (error) {
    console.error('[NETWORK_INSPECT]', error);
    return NextResponse.json(
      { error: 'Failed to inspect network' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/networks/[networkId]
export async function DELETE(
  request: Request,
  { params }: { params: { networkId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const network = docker.getNetwork(params.networkId);
    await network.remove();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NETWORK_DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete network' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/networks/[networkId]
export async function PATCH(
  request: Request,
  { params }: { params: { networkId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const network = docker.getNetwork(params.networkId);
    const { action } = await request.json();

    switch (action) {
      case 'connect':
        // Implement network connection logic
        break;
      case 'disconnect':
        // Implement network disconnection logic
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NETWORK_ACTION]', error);
    return NextResponse.json(
      { error: 'Failed to perform network action' },
      { status: 500 }
    );
  }
}