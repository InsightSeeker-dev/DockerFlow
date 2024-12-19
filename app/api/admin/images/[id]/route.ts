import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

// GET /api/admin/images/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const image = docker.getImage(params.id);
    const imageInfo = await image.inspect();

    // Formater les informations de l'image
    const formattedInfo = {
      id: imageInfo.Id,
      repository: imageInfo.RepoTags?.[0]?.split(':')[0] || '<none>',
      tag: imageInfo.RepoTags?.[0]?.split(':')[1] || '<none>',
      created: imageInfo.Created,
      size: imageInfo.Size,
      virtualSize: imageInfo.VirtualSize,
      digest: imageInfo.RepoDigests?.[0]?.split('@')[1] || '',
      labels: imageInfo.Config.Labels || {},
      history: imageInfo.History || [],
      architecture: imageInfo.Architecture,
      os: imageInfo.Os,
      author: imageInfo.Author,
      config: {
        env: imageInfo.Config.Env,
        cmd: imageInfo.Config.Cmd,
        workdir: imageInfo.Config.WorkingDir,
        exposedPorts: imageInfo.Config.ExposedPorts,
        volumes: imageInfo.Config.Volumes,
      },
    };

    return NextResponse.json(formattedInfo);
  } catch (error) {
    console.error('Error getting image:', error);
    return NextResponse.json(
      { error: 'Failed to get image details' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/images/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const image = docker.getImage(params.id);

    // Vérifier si l'image est utilisée par des conteneurs
    const containers = await docker.listContainers({ all: true });
    const isUsed = containers.some(container => container.ImageID === params.id);
    
    if (isUsed) {
      return NextResponse.json(
        { error: 'Image is being used by one or more containers' },
        { status: 400 }
      );
    }

    await image.remove({ force: false });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/images/[id]/tag
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const image = docker.getImage(params.id);
    await image.tag({
      repo: repository,
      tag: tag || 'latest'
    });

    return NextResponse.json({ message: 'Image tagged successfully' });
  } catch (error) {
    console.error('Error tagging image:', error);
    return NextResponse.json(
      { error: 'Failed to tag image' },
      { status: 500 }
    );
  }
}
