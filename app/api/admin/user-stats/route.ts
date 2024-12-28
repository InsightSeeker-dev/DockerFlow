import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer le nombre total d'utilisateurs
    const total = await prisma.user.count();

    // Récupérer le nombre d'utilisateurs actifs
    const active = await prisma.user.count({
      where: {
        status: 'ACTIVE'
      }
    });

    // Récupérer le nombre de nouveaux utilisateurs (dernières 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const new_users = await prisma.user.count({
      where: {
        createdAt: {
          gte: oneDayAgo
        }
      }
    });

    // Récupérer le nombre d'utilisateurs suspendus
    const suspended = await prisma.user.count({
      where: {
        status: 'SUSPENDED'
      }
    });

    return NextResponse.json({
      total,
      active,
      new: new_users,
      suspended
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user statistics' },
      { status: 500 }
    );
  }
}
