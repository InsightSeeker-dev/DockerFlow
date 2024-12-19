import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const containers = await docker.listContainers({ all: true });
    const formattedContainers = containers.map(container => ({
      id: container.Id,
      name: container.Names[0].replace(/^\//, ''),
      image: container.Image,
      state: container.State,
      status: container.Status,
      created: container.Created,
    }));

    return NextResponse.json(formattedContainers);
  } catch (error) {
    console.error('Error fetching containers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch containers' },
      { status: 500 }
    );
  }
}
