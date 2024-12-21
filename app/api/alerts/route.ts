import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma, AlertSeverity, AlertType } from '@prisma/client';
import { z } from 'zod';

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

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
