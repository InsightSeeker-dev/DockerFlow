import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/utils/auth-helpers';

// Cette route doit être dynamique car elle utilise des données de session
export const dynamic = 'force-dynamic';

// GET /api/admin/stats
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Récupérer les statistiques
    const [
      totalUsers,
      activeUsers,
      recentUsers,
      totalContainers,
      runningContainers,
      totalImages,
      totalAlerts,
      pendingAlerts,
      totalStorage,
    ] = await Promise.all([
      // Total des utilisateurs
      prisma.user.count(),

      // Utilisateurs actifs (status = 'active')
      prisma.user.count({
        where: { status: 'ACTIVE' }
      }),

      // Utilisateurs récents (7 derniers jours)
      prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Total des conteneurs
      prisma.container.count(),

      // Conteneurs en cours d'exécution
      prisma.container.count({
        where: { status: 'running' }
      }),

      // Total des images Docker
      prisma.dockerImage.count(),

      // Total des alertes
      prisma.alert.count(),

      // Alertes en attente
      prisma.alert.count({
        where: { status: 'PENDING' }
      }),

      // Utilisation totale du stockage
      prisma.userStorage.aggregate({
        _sum: {
          size: true
        }
      })
    ]);

    return NextResponse.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        recent: recentUsers
      },
      containers: {
        total: totalContainers,
        running: runningContainers
      },
      images: totalImages,
      alerts: {
        total: totalAlerts,
        pending: pendingAlerts
      },
      storage: totalStorage._sum.size || 0
    });
  } catch (error) {
    console.error('[STATS_GET]', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
