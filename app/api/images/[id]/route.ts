import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { imageActivity } from '@/lib/activity';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const docker = getDockerClient();
    const image = docker.getImage(params.id);
    
    // Récupérer les informations de l'image avant de la supprimer
    const imageInfo = await image.inspect();
    const imageName = imageInfo.RepoTags?.[0] || imageInfo.Id;
    
    // Supprimer l'image
    await image.remove();

    // Enregistrer l'activité
    await imageActivity.delete(session.user.id, imageName, {
      imageId: params.id,
      repoTags: imageInfo.RepoTags,
      size: imageInfo.Size,
      created: imageInfo.Created
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Image removal error:', error);
    return NextResponse.json(
      { error: 'Failed to remove image' },
      { status: 500 }
    );
  }
}