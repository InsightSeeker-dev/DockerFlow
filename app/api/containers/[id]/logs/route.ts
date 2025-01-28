import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getContainerLogs } from '@/lib/docker/container-service';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tail = searchParams.get('tail');
    const since = searchParams.get('since');
    const timestamps = searchParams.get('timestamps');

    const options = {
      tail: tail ? parseInt(tail) : undefined,
      since: since ? parseInt(since) : undefined,
      timestamps: timestamps === 'true',
    };

    const logs = await getContainerLogs(session.user.id, params.id, options);
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error getting container logs:', error);
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    );
  }
}