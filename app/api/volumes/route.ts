import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/lib/session';
import { getDockerClient } from '@/lib/docker';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { ActivityType, Prisma } from '@prisma/client';
import { getUserStorageUsage } from '@/lib/docker/storage';

const createVolumeSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9-]+$/, 'Volume name must contain only letters, numbers, and hyphens'),
  driver: z.string().optional().default('local'),
});

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const volumes = await prisma.volume.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        containerVolumes: {
          select: {
            id: true,
            mountPath: true,
            container: {
              select: {
                name: true,
                status: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(volumes);
  } catch (error) {
    console.error('Error fetching volumes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch volumes' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validatedData = createVolumeSchema.parse(body);
    const { name, driver } = validatedData;

    const existingVolume = await prisma.volume.findFirst({
      where: {
        name,
        userId: session.user.id
      }
    });

    if (existingVolume) {
      return NextResponse.json(
        { error: 'Volume with this name already exists' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { storageLimit: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentUsage = await getUserStorageUsage(session.user.id);
    if (currentUsage >= user.storageLimit) {
      return NextResponse.json(
        { error: 'Storage limit exceeded' },
        { status: 400 }
      );
    }

    const docker = await getDockerClient();

    const dockerVolume = await docker.createVolume({
      Name: name,
      Driver: driver,
    });

    const volume = await prisma.volume.create({
      data: {
        name,
        driver,
        mountpoint: dockerVolume.Mountpoint,
        size: 0,
        userId: session.user.id
      }
    });

    await prisma.activity.create({
      data: {
        type: ActivityType.CONTAINER_CREATE,
        description: `Volume ${name} created`,
        userId: session.user.id,
        metadata: {
          volumeId: volume.id,
          volumeName: volume.name,
          driver: volume.driver
        } as Prisma.JsonValue
      }
    });

    return NextResponse.json(volume);
  } catch (error) {
    console.error('Error creating volume:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid volume data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create volume' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const volumeId = searchParams.get('id');

    if (!volumeId) {
      return NextResponse.json(
        { error: 'Volume ID is required' },
        { status: 400 }
      );
    }

    const volume = await prisma.volume.findFirst({
      where: {
        id: volumeId,
        userId: session.user.id
      }
    });

    if (!volume) {
      return NextResponse.json(
        { error: 'Volume not found or unauthorized' },
        { status: 404 }
      );
    }

    const docker = await getDockerClient();

    try {
      await docker.getVolume(volume.name).remove();
    } catch (error) {
      console.error('Error removing Docker volume:', error);
    }

    await prisma.volume.delete({
      where: {
        id: volumeId
      }
    });

    await prisma.activity.create({
      data: {
        type: ActivityType.CONTAINER_DELETE,
        description: `Volume ${volume.name} deleted`,
        userId: session.user.id,
        metadata: {
          volumeId: volume.id,
          volumeName: volume.name
        } as Prisma.JsonValue
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting volume:', error);
    return NextResponse.json(
      { error: 'Failed to delete volume' },
      { status: 500 }
    );
  }
}