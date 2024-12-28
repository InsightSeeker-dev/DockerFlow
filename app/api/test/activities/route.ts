import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ActivityType } from '@prisma/client';

export async function POST() {
  try {
    // Récupérer le premier utilisateur admin
    const adminUser = await prisma.user.findFirst({
      where: {
        role: 'ADMIN'
      }
    });

    if (!adminUser) {
      return NextResponse.json({ error: 'No admin user found' }, { status: 404 });
    }

    // Créer une activité de test
    const activity = await prisma.activity.create({
      data: {
        type: ActivityType.USER_LOGIN,
        description: 'Test activity',
        userId: adminUser.id,
        metadata: { test: true },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      }
    });

    // Récupérer toutes les activités pour vérification
    const allActivities = await prisma.activity.findMany({
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
      createdActivity: activity,
      allActivities: allActivities,
      adminUser: {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Error in test activities:', error);
    return NextResponse.json(
      { error: 'Failed to test activities', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
