import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const containers = await docker.listContainers({ all: true });
    return NextResponse.json(containers);
  } catch (error) {
    console.error('Docker error:', error);
    return NextResponse.json({ error: 'Failed to fetch containers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const { action, containerId } = await request.json();
    const container = docker.getContainer(containerId);

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
      case 'remove':
        await container.remove({ force: true });
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Docker error:', error);
    return NextResponse.json({ error: 'Failed to perform container action' }, { status: 500 });
  }
}
