import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole, UserStatus, ActivityType } from '@prisma/client';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== UserRole.ADMIN || session.user.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Créer quelques activités de test
    const testActivities = [
      {
        type: ActivityType.USER_LOGIN,
        description: 'User logged in',
        userId: session.user.id,
        metadata: { browser: 'Chrome' },
      },
      {
        type: ActivityType.CONTAINER_CREATE,
        description: 'Created container: test-nginx',
        userId: session.user.id,
        metadata: { image: 'nginx:latest' },
      },
      {
        type: ActivityType.IMAGE_PULL,
        description: 'Pulled image: redis:latest',
        userId: session.user.id,
        metadata: { size: '150MB' },
      },
    ];

    // Insérer les activités de test
    await Promise.all(
      testActivities.map(activity =>
        prisma.activity.create({
          data: {
            type: activity.type,
            description: activity.description,
            userId: activity.userId,
            metadata: activity.metadata,
            ipAddress: '127.0.0.1',
            userAgent: 'Test Agent',
          },
        })
      )
    );

    return NextResponse.json({ success: true, message: 'Test activities created' });
  } catch (error) {
    console.error('Error creating test activities:', error);
    return NextResponse.json(
      { error: 'Failed to create test activities' },
      { status: 500 }
    );
  }
}
