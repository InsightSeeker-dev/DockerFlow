import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { isAdmin } from '@/lib/utils/auth-helpers';

// Cette route doit être dynamique car elle utilise des données de session
export const dynamic = 'force-dynamic';

// PUT /api/admin/alerts/[id]/acknowledge
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session) || !session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(params.id)) {
      return NextResponse.json(
        { error: 'Invalid alert ID format' },
        { status: 400 }
      );
    }

    // Check if alert exists
    const existingAlert = await prisma.alert.findUnique({
      where: { id: params.id }
    });

    if (!existingAlert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    const alert = await prisma.alert.update({
      where: {
        id: params.id,
      },
      data: {
        acknowledged: true,
        acknowledgedById: session.user.id,
        updatedAt: new Date()
      },
      include: {
        acknowledgedByUser: {
          select: {
            name: true,
            email: true,
          },
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
