import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/alerts
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
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
      timestamp: {
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
        timestamp: 'desc',
      },
    });

    return new NextResponse(JSON.stringify(alerts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in alerts route:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/admin/alerts
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { type, title, message, source } = body;

    const alert = await prisma.alert.create({
      data: {
        type,
        title,
        message,
        source,
        timestamp: new Date(),
        acknowledged: false,
      },
    });

    return new NextResponse(JSON.stringify(alert), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
