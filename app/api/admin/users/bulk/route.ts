import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { action, userIds } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty user IDs array' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'suspend':
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { status: 'SUSPENDED' },
        });
        // Déconnecter les sessions des utilisateurs suspendus
        await prisma.session.deleteMany({
          where: { userId: { in: userIds } },
        });
        break;

      case 'activate':
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { status: 'ACTIVE' },
        });
        break;

      case 'delete':
        // Supprimer toutes les données associées aux utilisateurs
        await prisma.$transaction([
          prisma.container.deleteMany({
            where: { userId: { in: userIds } },
          }),
          prisma.userStorage.deleteMany({
            where: { userId: { in: userIds } },
          }),
          prisma.dockerImage.deleteMany({
            where: { userId: { in: userIds } },
          }),
          prisma.user.deleteMany({
            where: { id: { in: userIds } },
          }),
        ]);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      message: `Bulk ${action} completed successfully`,
    });
  } catch (error) {
    console.error('Failed to perform bulk action:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}
