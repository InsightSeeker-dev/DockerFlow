import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const acknowledged = searchParams.get('acknowledged');
    const severity = searchParams.get('severity');
    const limit = searchParams.get('limit');

    const alerts = await prisma.alert.findMany({
      where: {
        userId: session.user.id,
        ...(acknowledged !== null && { acknowledged: acknowledged === 'true' }),
        ...(severity && { severity }),
      },
      orderBy: { timestamp: 'desc' },
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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { type, severity, message, resourceId, threshold, currentValue } = data;

    const alert = await prisma.alert.create({
      data: {
        userId: session.user.id,
        type,
        severity,
        message,
        resourceId,
        threshold,
        currentValue,
      },
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
