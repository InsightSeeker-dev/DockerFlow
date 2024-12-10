import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { checkStorageLimit, getImageSize } from '@/lib/docker/storage';
import { pullImage } from '@/lib/docker/images';
import { Session } from 'next-auth';
import { Prisma } from '@prisma/client';

interface ExtendedSession extends Session {
  user: {
    id: string;
    email: string;
    role: string;
  } & Session['user']
}

const createContainerSchema = z.object({
  name: z.string(),
  image: z.string(),
  ports: z.array(z.string()).optional(),
  useStorageImage: z.boolean().optional(),
});

const containerActionSchema = z.object({
  action: z.enum(['start', 'stop', 'remove']),
  containerId: z.string(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const docker = getDockerClient();
    const containers = await docker.listContainers({ all: true });
    
    // Get user's containers from database
    const userContainers = await prisma.container.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    
    const userContainerIds = new Set(userContainers.map((container: { id: any; }) => container.id));
    
    // Filter Docker containers to only show user's containers
    const filteredContainers = containers.filter(container => userContainerIds.has(container.Id));
    
    return NextResponse.json({ containers: filteredContainers });
  } catch (error) {
    console.error('Container API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch containers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, image, ports, useStorageImage } = createContainerSchema.parse(body);

    // Check storage limit before creating container
    const imageSize = await getImageSize(image);
    const hasSpace = await checkStorageLimit(session.user.id, imageSize);
    
    if (!hasSpace) {
      return NextResponse.json(
        { error: 'Storage limit exceeded. Please remove some containers or images to free up space.' },
        { status: 400 }
      );
    }

    const docker = getDockerClient();

    // If using a storage image, check if it exists
    let finalImage = image;
    if (useStorageImage) {
      const storageImage = await prisma.userStorage.findFirst({
        where: {
          userId: session.user.id,
          isDockerImage: true,
          name: image,
        },
      });

      if (!storageImage) {
        return NextResponse.json(
          { error: `Docker image ${image} not found in your storage` },
          { status: 404 }
        );
      }

      // Use the stored Docker image ID
      finalImage = storageImage.dockerImageId || image;
    }

    // Check if image exists locally, if not pull it
    try {
      await docker.getImage(finalImage).inspect();
    } catch (error) {
      // Image doesn't exist locally, try to pull it
      try {
        await pullImage(session.user.id, finalImage);
      } catch (pullError) {
        return NextResponse.json(
          { error: `Failed to pull image: ${finalImage}. Please make sure the image name is correct and you have internet connection.` },
          { status: 400 }
        );
      }
    }

    // Check if container name is already taken by this user
    const existingContainer = await prisma.container.findFirst({
      where: {
        name,
        userId: session.user.id
      }
    });

    if (existingContainer) {
      return NextResponse.json(
        { error: 'Container name already exists' },
        { status: 400 }
      );
    }

    // Create container and start it
    const containerInfo = await docker.createContainer({
      Image: finalImage,
      name,
      HostConfig: {
        PortBindings: ports ? Object.fromEntries(
          ports.map(port => {
            const [hostPort, containerPort] = port.split(':');
            return [
              `${containerPort}/tcp`,
              [{ HostPort: hostPort }]
            ];
          })
        ) : {}
      }
    });

    await containerInfo.start();
    const containerState = await containerInfo.inspect();

    // Save container to database with user association
    await prisma.container.create({
      data: {
        id: containerInfo.id,
        name,
        image: finalImage,
        status: containerState.State?.Status || 'created',
        userId: session.user.id
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Container creation error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create container' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, containerId } = containerActionSchema.parse(body);

    // Verify container ownership
    const container = await prisma.container.findFirst({
      where: {
        id: containerId,
        userId: session.user.id
      }
    });

    if (!container) {
      return NextResponse.json(
        { error: 'Container not found or access denied' },
        { status: 403 }
      );
    }

    const docker = getDockerClient();
    const dockerContainer = docker.getContainer(containerId);

    switch (action) {
      case 'start':
        await dockerContainer.start();
        await prisma.container.update({
          where: { id: containerId },
          data: { status: 'running' }
        });
        break;
      case 'stop':
        await dockerContainer.stop();
        await prisma.container.update({
          where: { id: containerId },
          data: { status: 'exited' }
        });
        break;
      case 'remove':
        await dockerContainer.remove({ force: true });
        await prisma.container.delete({
          where: { id: containerId }
        });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Container action error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to perform container action' },
      { status: 500 }
    );
  }
}