import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const docker = getDockerClient();
    const images = await docker.listImages();
    
    // Filter images to only include those with valid RepoTags
    const validImages = images.filter(img => Array.isArray(img.RepoTags) && img.RepoTags.length > 0);
    
    console.log('Available Docker images:', validImages);
    
    return NextResponse.json(validImages);
  } catch (error) {
    console.error('Error fetching Docker images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Docker images' },
      { status: 500 }
    );
  }
}
