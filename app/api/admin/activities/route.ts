import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole, UserStatus } from '@prisma/client';

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

    // Récupérer le nombre total d'activités
    const total = await prisma.activity.count();

    // Récupérer les activités paginées
    const activities = await prisma.activity.findMany({
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
