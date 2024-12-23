import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole, UserStatus } from '@prisma/client';

export async function GET() {
  try {
    console.log('GET /api/admin/activities - Start');
    const session = await getServerSession(authOptions);
    console.log('Session:', session);

    if (!session?.user || session.user.role !== UserRole.ADMIN || session.user.status !== UserStatus.ACTIVE) {
      console.log('Unauthorized access attempt:', session?.user);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer les activités récentes
    console.log('Fetching activities from database...');
    const activities = await prisma.activity.findMany({
      take: 10, // Limiter à 10 activités
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

    console.log('Found activities:', activities);
    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error in GET /api/admin/activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
