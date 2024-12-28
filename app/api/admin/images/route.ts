import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

export const dynamic = 'force-dynamic';

interface ExtendedImageInfo extends Docker.ImageInspectInfo {
  History?: Array<{
    Created: string;
    CreatedBy: string;
    Comment: string;
    EmptyLayer?: boolean;
  }>;
}

// GET /api/admin/images
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const images = await docker.listImages({ all: true });
    const formattedImages = await Promise.all(images.map(async (image) => {
      // Obtenir les détails de l'image avec le type étendu
      const imageDetails = await docker.getImage(image.Id).inspect() as ExtendedImageInfo;

      // Formater les tags en repository et tag
      const tags = image.RepoTags?.[0]?.split(':') || ['<none>', '<none>'];
      const [repository, tag] = tags;

      return {
        id: image.Id,
        repository,
        tag,
        created: new Date(image.Created * 1000).toISOString(),
        size: image.Size,
        virtualSize: image.VirtualSize,
        digest: imageDetails.RepoDigests?.[0]?.split('@')[1] || '',
        labels: imageDetails.Config?.Labels || {},
        history: imageDetails.History || [],
      };
    }));

    return NextResponse.json(formattedImages);
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}

// POST /api/admin/images/pull
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { repository, tag } = await request.json();
    if (!repository) {
      return NextResponse.json(
        { error: 'Repository name is required' },
        { status: 400 }
      );
    }

    const imageName = `${repository}:${tag || 'latest'}`;
    
    // Créer un stream pour suivre le pull de l'image
    const stream = await docker.pull(imageName);

    // Attendre que le pull soit terminé
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err: Error | null, res: any[]) => {
        if (err) reject(err);
        resolve(res);
      });
    });

    return NextResponse.json({ message: 'Image pulled successfully' });
  } catch (error) {
    console.error('Error pulling image:', error);
    return NextResponse.json(
      { error: 'Failed to pull image' },
      { status: 500 }
    );
  }
}
