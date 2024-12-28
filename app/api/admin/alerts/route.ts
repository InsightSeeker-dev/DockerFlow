import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AlertType, AlertSeverity } from '@prisma/client';
import { z } from 'zod';

const createAlertSchema = z.object({
  type: z.enum(['CONTAINER', 'SYSTEM', 'USER']),
  title: z.string(),
  message: z.string(),
  source: z.string().optional(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
});

// GET /api/admin/alerts
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const acknowledged = searchParams.get('acknowledged');
    const timeRange = searchParams.get('timeRange');

    // Calculer la date de début en fonction de la plage de temps
    const now = new Date();
    let startDate = new Date();
    switch (timeRange) {
      case '1h':
        startDate.setHours(now.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setDate(now.getDate() - 1); // Par défaut 24h
    }

    // Construire la requête avec les filtres
    const where: any = {
      createdAt: {
        gte: startDate,
      },
    };

    if (type && type !== 'all') {
      where.type = type;
    }

    if (acknowledged && acknowledged !== 'all') {
      where.acknowledged = acknowledged === 'true';
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        acknowledgedByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('[ALERTS_GET]', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

// POST /api/admin/alerts
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, title, message, source, severity } = createAlertSchema.parse(body);

    const alert = await prisma.alert.create({
      data: {
        type: type as AlertType,
        title,
        message,
        source,
        severity: severity as AlertSeverity || AlertSeverity.INFO,
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('[ALERTS_POST]', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
