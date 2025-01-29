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
      // Inspecter l'image pour obtenir les ports exposés
      const image = await docker.getImage(imageName).inspect();
      const exposedPorts = image.Config.ExposedPorts || {};
      
      // Extraire les numéros de port (format: "3000/tcp" => 3000)
      const ports = Object.keys(exposedPorts)
        .map(port => parseInt(port.split('/')[0], 10))
        .filter(port => !isNaN(port));

      return NextResponse.json({ ports });
    } catch (error) {
      console.error('Error inspecting image:', error);
      return NextResponse.json({ ports: [] }); // Retourner une liste vide en cas d'erreur
    }
  } catch (error) {
    console.error('Error getting image ports:', error);
    return NextResponse.json(
      { error: 'Failed to get image ports' },
      { status: 500 }
    );
  }
}
