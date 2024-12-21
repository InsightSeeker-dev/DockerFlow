import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { docker } from '@/lib/docker';
import { isAdmin } from '@/lib/utils/auth-helpers';
import { getContainerStats } from '@/lib/utils/docker-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/containers
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const containers = await docker.listContainers({ all: true });
    const containerPromises = containers.map(async (container) => {
      const containerInstance = docker.getContainer(container.Id);
      const inspectData = await containerInstance.inspect();
      const stats = await getContainerStats(containerInstance);

      const containerInfo = {
        id: container.Id,
        name: container.Names[0].replace(/^\//, ''),
        image: container.Image,
        state: container.State,
        status: container.Status,
        created: new Date(container.Created * 1000).toISOString(),
        ports: container.Ports,
        stats,
        ...inspectData,
      };

      // Filter by status if provided
      if (status && containerInfo.state !== status) {
        return null;
      }

      // Filter by search term if provided
      if (search) {
        const searchTerm = search.toLowerCase();
        const matchesName = containerInfo.name.toLowerCase().includes(searchTerm);
        const matchesImage = containerInfo.image.toLowerCase().includes(searchTerm);
        const matchesId = containerInfo.id.toLowerCase().includes(searchTerm);

        if (!matchesName && !matchesImage && !matchesId) {
          return null;
        }
      }

      return containerInfo;
    });

    const results = (await Promise.all(containerPromises)).filter(Boolean);
    return NextResponse.json(results);
  } catch (error) {
    console.error('[CONTAINERS_LIST]', error);
    return NextResponse.json(
      { error: 'Failed to list containers' },
      { status: 500 }
    );
  }
}

// POST /api/admin/containers
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const container = await docker.createContainer(body);
    await container.start();

    return NextResponse.json({
      id: container.id,
      message: 'Container created successfully',
    });
  } catch (error) {
    console.error('[CONTAINER_CREATE]', error);
    return NextResponse.json(
      { error: 'Failed to create container' },
      { status: 500 }
    );
  }
}
