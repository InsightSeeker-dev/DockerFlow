import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hash, compare } from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const formData = await request.formData();
    const updates: any = {};

    // Handle basic fields
    ['name', 'email', 'bio'].forEach(field => {
      const value = formData.get(field);
      if (value) updates[field] = value;
    });

    // Handle Docker settings
    const defaultRegistry = formData.get('defaultRegistry');
    const autoUpdate = formData.get('autoUpdate');
    const resourceLimits = formData.get('resourceLimits');

    if (defaultRegistry) updates.defaultRegistry = defaultRegistry;
    if (autoUpdate) updates.autoUpdate = autoUpdate === 'true';
    if (resourceLimits) {
      try {
        updates.resourceLimits = JSON.parse(resourceLimits as string);
      } catch (e) {
        console.error('Failed to parse resource limits:', e);
      }
    }

    // Handle notification settings
    const notifications = formData.get('notifications');
    if (notifications) {
      try {
        updates.notifications = JSON.parse(notifications as string);
      } catch (e) {
        console.error('Failed to parse notifications:', e);
      }
    }

    // Handle password change
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');

    if (currentPassword && newPassword && confirmPassword) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id as string },
        select: { password: true },
      });

      const isValid = await compare(currentPassword as string, user!.password);
      if (!isValid) {
        return new NextResponse('Invalid current password', { status: 400 });
      }

      if (newPassword !== confirmPassword) {
        return new NextResponse('Passwords do not match', { status: 400 });
      }

      updates.password = await hash(newPassword as string, 12);
    }

    // Handle avatar upload
    const avatar = formData.get('avatar') as File;
    if (avatar) {
      // Here you would typically:
      // 1. Upload the file to a storage service (e.g., S3)
      // 2. Get the URL of the uploaded file
      // 3. Save the URL to the database
      // For now, we'll skip this part
    }

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id as string },
      data: updates,
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error('Settings update error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}