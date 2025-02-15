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
import { imageActivity } from '@/lib/activity';

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
    const images = await docker.listImages({ all: true });
    
    // Transformer les images pour inclure les informations nécessaires
    const formattedImages = images.map(image => ({
      id: image.Id,
      displayName: image.RepoTags?.[0]?.split(':')[0] || 'unknown',
      displayTag: image.RepoTags?.[0]?.split(':')[1] || 'latest',
      RepoTags: image.RepoTags || [],
      Created: image.Created,
      Size: image.Size,
      VirtualSize: image.VirtualSize
    }));

    // Log pour le débogage
    console.log('Docker images retrieved:', formattedImages);

    return NextResponse.json(formattedImages);
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
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
      // Pull image from Docker Hub
      const { image, tag = 'latest' } = await request.json();
      const imageName = `${image}:${tag}`;

      const stream = await docker.pull(imageName);
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err: any, res: any) => err ? reject(err) : resolve(res));
      });

      // Enregistrer l'activité
      await imageActivity.pull(session.user.id, imageName, {
        tag,
        repository: image,
        timestamp: new Date().toISOString()
      });

      // Save image to user's storage
      const savedImage = await prisma.dockerImage.create({
        data: {
          name,
          tag: tag || 'latest',
          size: await getImageSize(imageName),
          userId: session.user.id,
        },
      });

      // Also track the storage usage
      await prisma.userStorage.create({
        data: {
          path: `/docker/images/${name}`,
          size: await getImageSize(imageName),
          userId: session.user.id,
        },
      });

      return NextResponse.json({ success: true, image: savedImage });
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