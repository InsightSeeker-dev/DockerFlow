import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Vérifier si l'utilisateur est authentifié et est un admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Récupérer les statistiques
    const [
      totalUsers,
      totalContainers,
      totalStorage,
      activeUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.container.count(),
      prisma.userStorage.aggregate({
        _sum: {
          size: true
        }
      }),
      prisma.user.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return NextResponse.json({
      totalUsers,
      totalContainers,
      totalStorage: totalStorage._sum.size || 0,
      activeUsers,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
