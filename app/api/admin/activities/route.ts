import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole, UserStatus, ActivityType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, status: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (user.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: 'Account not active' }, { status: 403 });
    }

    // Calculer la date d'il y a 5 jours
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    // Récupérer le nombre total d'activités des 5 derniers jours
    const total = await prisma.activity.count({
      where: {
        createdAt: {
          gte: fiveDaysAgo
        }
      }
    });

    // Récupérer les activités paginées des 5 derniers jours
    const activities = await prisma.activity.findMany({
      where: {
        createdAt: {
          gte: fiveDaysAgo
        }
      },
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: {
          select: {
            username: true,
            email: true,
            role: true
          }
        }
      }
    });

    return NextResponse.json({
      activities,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, status: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: 'Account not active' }, { status: 403 });
    }

    const { type, description, metadata } = await request.json();

    // Vérifier que le type d'activité est valide
    if (!Object.values(ActivityType).includes(type)) {
      return NextResponse.json({ error: 'Invalid activity type' }, { status: 400 });
    }

    // Créer l'activité
    const activity = await prisma.activity.create({
      data: {
        type,
        description,
        metadata: metadata || {},
        userId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json(activity);
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}
