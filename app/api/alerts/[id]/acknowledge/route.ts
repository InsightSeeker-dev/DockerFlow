import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/alerts/[id]/acknowledge
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const alert = await prisma.alert.update({
      where: { id: params.id },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedById: session.user.id,
        status: 'resolved'
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        acknowledgedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
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
