import { NextResponse } from 'next/server';
import { getContainer } from '@/lib/docker/container-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const container = await getContainer(session.user.id, params.id);
    return NextResponse.json(container);
  } catch (error) {
    console.error('Error fetching container:', error);
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    );
  }
}
