import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDockerClient } from "@/lib/docker/client";
import { UserRole } from "@prisma/client";
import { imageActivity } from '@/lib/activity';

const docker = getDockerClient();

// GET /api/admin/images/[imageId]
export async function GET(
  request: Request,
  { params }: { params: { imageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const image = docker.getImage(params.imageId);
    const imageInfo = await image.inspect();
    const imageHistory = await image.history();

    return NextResponse.json({
      info: imageInfo,
      history: imageHistory
    });
  } catch (error) {
    console.error('[IMAGE_INFO]', error);
    return NextResponse.json(
      { error: 'Failed to get image information' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/images/[imageId]
export async function DELETE(
  request: Request,
  { params }: { params: { imageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const image = docker.getImage(params.imageId);
    
    // Récupérer les informations de l'image avant de la supprimer
    const imageInfo = await image.inspect();
    const imageName = imageInfo.RepoTags?.[0] || imageInfo.Id;
    
    // Supprimer l'image
    await image.remove();

    // Enregistrer l'activité
    await imageActivity.delete(session.user.id, imageName, {
      imageId: params.imageId,
      size: imageInfo.Size,
      tags: imageInfo.RepoTags,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[IMAGE_DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/images/[imageId]/tag
export async function PATCH(
  request: Request,
  { params }: { params: { imageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tag } = await request.json();
    if (!tag) {
      return NextResponse.json(
        { error: 'Tag is required' },
        { status: 400 }
      );
    }

    const image = docker.getImage(params.imageId);
    await image.tag({ repo: tag });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[IMAGE_TAG]', error);
    return NextResponse.json(
      { error: 'Failed to tag image' },
      { status: 500 }
    );
  }
}
