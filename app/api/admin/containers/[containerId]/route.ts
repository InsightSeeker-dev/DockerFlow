import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { docker } from '@/lib/docker';
import { isAdmin } from '@/lib/utils/auth-helpers';

export const dynamic = 'force-dynamic';

// Cette route fournit des informations détaillées sur un conteneur spécifique
// La suppression des conteneurs est désormais gérée par la route PATCH unifiée /api/containers/[id]
export async function GET(
  request: Request,
  { params }: { params: { containerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const container = docker.getContainer(params.containerId);
    const containerInfo = await container.inspect();
    const stats = await container.stats({ stream: false });

    return NextResponse.json({
      ...containerInfo,
      stats,
    });
  } catch (error) {
    console.error('[CONTAINER_INSPECT]', error);
    return NextResponse.json(
      { error: 'Failed to inspect container' },
      { status: 500 }
    );
  }
}
