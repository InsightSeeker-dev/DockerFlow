import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

// GET /api/admin/images/[imageId]
export async function GET(
  request: Request,
  { params }: { params: { imageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
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
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const image = docker.getImage(params.imageId);
    await image.remove();

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
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
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
