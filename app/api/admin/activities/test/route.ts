import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole, UserStatus, ActivityType } from '@prisma/client';

export async function POST() {
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

    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (user.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: 'Account not active' }, { status: 403 });
    }

    const testActivities = [
      {
        type: ActivityType.USER_LOGIN,
        description: 'User admin logged in',
        metadata: { browser: 'Chrome', platform: 'Windows' }
      },
      {
        type: ActivityType.CONTAINER_CREATE,
        description: 'Created container: nginx-web',
        metadata: { image: 'nginx:latest', ports: ['80:80'] }
      },
      {
        type: ActivityType.CONTAINER_START,
        description: 'Started container: nginx-web',
        metadata: { containerId: 'test-123' }
      },
      {
        type: ActivityType.IMAGE_PULL,
        description: 'Pulled image: postgres:latest',
        metadata: { size: '120MB', tag: 'latest' }
      },
      {
        type: ActivityType.ALERT_TRIGGERED,
        description: 'High CPU usage detected',
        metadata: { cpu: '95%', threshold: '90%' }
      }
    ];

    const createdActivities = await Promise.all(
      testActivities.map(activity =>
        prisma.activity.create({
          data: {
            type: activity.type,
            description: activity.description,
            userId: user.id,
            metadata: activity.metadata,
            ipAddress: '127.0.0.1',
            userAgent: 'Test/1.0',
            createdAt: new Date()
          }
        })
      )
    );

    return NextResponse.json({
      message: 'Test activities created successfully',
      count: createdActivities.length
    });
  } catch (error) {
    console.error('Error creating test activities:', error);
    return NextResponse.json(
      { error: 'Failed to create test activities' },
      { status: 500 }
    );
  }
}
