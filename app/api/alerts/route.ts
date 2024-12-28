import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma, AlertSeverity, AlertType, AlertStatus } from '@prisma/client';
import { z } from 'zod';
import { alertActivity } from '@/lib/activity';

const alertQuerySchema = z.object({
  userId: z.string().optional(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
  limit: z.string().optional(),
});

const createAlertSchema = z.object({
  type: z.enum(['CONTAINER', 'SYSTEM', 'USER']),
  title: z.string(),
  message: z.string(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional(),
});

const alertActionSchema = z.object({
  action: z.enum(['acknowledge', 'resolve', 'dismiss']),
  alertId: z.string(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = alertQuerySchema.parse(Object.fromEntries(searchParams));
    const { severity, limit } = query;

    const alerts = await prisma.alert.findMany({
      where: {
        userId: session.user.id,
        ...(severity && { severity: severity as AlertSeverity }),
      },
      orderBy: [{ id: 'desc' }],
      take: limit ? parseInt(limit) : 50,
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { type, title, message, severity } = createAlertSchema.parse(body);

    const alert = await prisma.alert.create({
      data: {
        type: type as AlertType,
        title,
        message,
        userId: session.user.id,
        ...(severity && { severity: severity as AlertSeverity }),
      }
    });

    // Enregistrer l'activité
    await alertActivity.triggered(session.user.id, title, {
      type,
      severity,
      message,
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = alertActionSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const { action, alertId } = result.data;

    const alert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        userId: session.user.id,
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'acknowledge':
        await prisma.alert.update({
          where: { id: alertId },
          data: {
            acknowledged: true,
            acknowledgedById: session.user.id,
            acknowledgedAt: new Date(),
          },
        });
        break;

      case 'resolve':
        await prisma.alert.update({
          where: { id: alertId },
          data: {
            status: AlertStatus.RESOLVED,
            acknowledgedById: session.user.id,
            acknowledgedAt: new Date(),
          },
        });
        // Enregistrer l'activité
        await alertActivity.resolved(session.user.id, alert.title);
        break;

      case 'dismiss':
        await prisma.alert.update({
          where: { id: alertId },
          data: {
            status: AlertStatus.DISMISSED,
            acknowledgedById: session.user.id,
            acknowledgedAt: new Date(),
          },
        });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}
