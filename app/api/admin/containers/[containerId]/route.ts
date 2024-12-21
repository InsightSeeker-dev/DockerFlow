import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { docker } from '@/lib/docker';
import { isAdmin } from '@/lib/utils/auth-helpers';

export async function GET(
  request: Request,
  { params }: { params: { containerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const container = docker.getContainer(params.containerId);
    const containerInfo = await container.inspect();
    const stats = await container.stats({ stream: false });

    return NextResponse.json({
      ...containerInfo,
      stats,
    });
  } catch (error) {
    console.error('[CONTAINER_INSPECT]', error);
    return NextResponse.json(
      { error: 'Failed to inspect container' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { containerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const container = docker.getContainer(params.containerId);
    await container.remove({ force: true });

    return NextResponse.json({ message: 'Container deleted successfully' });
  } catch (error) {
    console.error('[CONTAINER_DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete container' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { containerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const container = docker.getContainer(params.containerId);
    const { action } = await request.json();

    switch (action) {
      case 'start':
        await container.start();
        break;
      case 'stop':
        await container.stop();
        break;
      case 'restart':
        await container.restart();
        break;
      case 'pause':
        await container.pause();
        break;
      case 'unpause':
        await container.unpause();
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ message: 'Container updated successfully' });
  } catch (error) {
    console.error('[CONTAINER_UPDATE]', error);
    return NextResponse.json(
      { error: 'Failed to update container' },
      { status: 500 }
    );
  }
}
