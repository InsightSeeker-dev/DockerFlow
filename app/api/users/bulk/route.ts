import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ActivityType } from '@prisma/client';
import { userActivity } from '@/lib/activity';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Récupérer l'ID de l'administrateur depuis la base de données
    const admin = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!admin) {
      return new NextResponse('Admin not found', { status: 404 });
    }

    const { action, userIds } = await req.json();

    if (!action || !userIds || !Array.isArray(userIds)) {
      return new NextResponse('Invalid request body', { status: 400 });
    }

    // Récupérer les informations des utilisateurs avant la modification
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, status: true }
    });

    switch (action.toLowerCase()) {
      case 'suspend':
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { status: 'SUSPENDED' },
        });

        // Créer une activité pour chaque utilisateur suspendu
        await Promise.all(users.map(user => 
          userActivity.update(admin.id, `User ${user.username} was suspended`, {
            action: 'suspend',
            targetUserId: user.id,
            previousStatus: user.status,
            newStatus: 'SUSPENDED'
          })
        ));
        break;

      case 'activate':
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { status: 'ACTIVE' },
        });

        // Créer une activité pour chaque utilisateur activé
        await Promise.all(users.map(user => 
          userActivity.update(admin.id, `User ${user.username} was activated`, {
            action: 'activate',
            targetUserId: user.id,
            previousStatus: user.status,
            newStatus: 'ACTIVE'
          })
        ));
        break;

      case 'delete':
        // Supprimer d'abord toutes les activités des utilisateurs
        await prisma.activity.deleteMany({
          where: { userId: { in: userIds } },
        });

        // Supprimer les conteneurs des utilisateurs
        await prisma.container.deleteMany({
          where: { userId: { in: userIds } },
        });
        
        // Supprimer les alertes des utilisateurs
        await prisma.alert.deleteMany({
          where: { 
            OR: [
              { userId: { in: userIds } },
              { acknowledgedById: { in: userIds } }
            ]
          },
        });

        // Supprimer les sessions du terminal
        await prisma.terminalSession.deleteMany({
          where: { userId: { in: userIds } },
        });

        // Supprimer les tokens de vérification
        await prisma.verificationToken.deleteMany({
          where: { userId: { in: userIds } },
        });
        
        // Créer une activité pour chaque utilisateur supprimé
        await Promise.all(users.map(user => 
          userActivity.delete(admin.id, user.username, {
            action: 'delete',
            targetUserId: user.id,
            previousStatus: user.status
          })
        ));

        // Enfin, supprimer les utilisateurs
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
        break;

      default:
        return new NextResponse(`Invalid action: ${action}`, { status: 400 });
    }

    return new NextResponse('Bulk action completed successfully');
  } catch (error) {
    console.error('Error performing bulk action:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
