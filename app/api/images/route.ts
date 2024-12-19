import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Session } from 'next-auth';
import { pullImage } from '@/lib/docker/images';
import { checkStorageLimit, getImageSize, getUserStorageUsage } from '@/lib/docker/storage';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getDockerClient } from '@/lib/docker/client';
import { Prisma } from '@prisma/client';

interface ExtendedSession extends Session {
  user: {
    id: string;
    email: string;
    role: string;
  } & Session['user']
}

const pullImageSchema = z.object({
  imageName: z.string()
});

const saveImageSchema = z.object({
  name: z.string(),
  tag: z.string().optional(),
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
    const images = await docker.listImages();
    const storageUsage = await getUserStorageUsage(session.user.id);
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      images: images.map(image => ({
        id: image.Id,
        name: image.RepoTags?.[0]?.split(':')[0] || 'none',
        tag: image.RepoTags?.[0]?.split(':')[1] || 'latest',
        size: image.Size,
        created: image.Created,
      })),
      storageUsage: {
        used: storageUsage,
        total: user.storageLimit,
      }
    });
  } catch (error) {
    console.error('List images error:', error);
    return NextResponse.json(
      { error: 'Failed to list images' },
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
    const { name, tag } = saveImageSchema.parse(body);

    const docker = getDockerClient();

    // Check if image exists locally
    try {
      const image = await docker.getImage(name).inspect();
      const imageSize = image.Size || 0;

      // Check storage limit
      const hasSpace = await checkStorageLimit(session.user.id, imageSize);
      if (!hasSpace) {
        return NextResponse.json(
          { error: 'Storage limit exceeded. Please remove some images to free up space.' },
          { status: 400 }
        );
      }

      // Save image to user's storage
      const savedImage = await prisma.dockerImage.create({
        data: {
          name,
          tag: tag || 'latest',
          size: imageSize,
          userId: session.user.id,
        },
      });

      // Also track the storage usage
      await prisma.userStorage.create({
        data: {
          path: `/docker/images/${name}`,
          size: imageSize,
          userId: session.user.id,
        },
      });

      return NextResponse.json({ success: true, image: savedImage });
    } catch (error) {
      return NextResponse.json(
        { error: 'Image not found locally. Please pull the image first.' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Save image error:', error);
    return NextResponse.json(
      { error: 'Failed to save image' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');

    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    // Delete from user storage
    await prisma.userStorage.delete({
      where: {
        id: imageId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete image error:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}