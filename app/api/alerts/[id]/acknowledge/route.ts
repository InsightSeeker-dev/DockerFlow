import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAuthenticated } from '@/lib/utils/auth-helpers';
import { ALERT_STATUS } from '@/lib/constants/alert';
import { Session } from 'next-auth';

// PATCH /api/alerts/[id]/acknowledge
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAuthenticated(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TypeScript sait maintenant que authenticatedSession a le bon type
    const authenticatedSession: Session & { user: { id: string } } = session;

    const alert = await prisma.alert.update({
      where: {
        id: params.id,
      },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedById: authenticatedSession.user.id,
        status: ALERT_STATUS.RESOLVED
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          }
        },
        acknowledgedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          }
        }
      }
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('[ALERT_ACKNOWLEDGE]', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge alert' },
      { status: 500 }
    );
  }
}
