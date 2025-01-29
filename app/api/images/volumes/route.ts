import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDockerClient } from '@/lib/docker/client';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const imageName = searchParams.get('image');

    if (!imageName) {
      return NextResponse.json(
        { error: 'Image name is required' },
        { status: 400 }
      );
    }

    const docker = getDockerClient();
    
    try {
      // Inspecter l'image pour obtenir les volumes
      const image = await docker.getImage(imageName).inspect();
      const volumes = image.Config.Volumes || {};
      
      // Extraire les chemins de volumes
      const volumePaths = Object.keys(volumes);

      return NextResponse.json({ volumes: volumePaths });
    } catch (error) {
      console.error('Error inspecting image:', error);
      return NextResponse.json({ volumes: [] }); // Retourner une liste vide en cas d'erreur
    }
  } catch (error) {
    console.error('Error getting image volumes:', error);
    return NextResponse.json(
      { error: 'Failed to get image volumes' },
      { status: 500 }
    );
  }
}
