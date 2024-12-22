import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { action, userIds } = await req.json();

    if (!action || !userIds || !Array.isArray(userIds)) {
      return new NextResponse('Invalid request body', { status: 400 });
    }

    switch (action.toLowerCase()) {
      case 'suspend':
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { status: 'SUSPENDED' },
        });
        break;

      case 'activate':
        await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { status: 'ACTIVE' },
        });
        break;

      case 'delete':
        // Delete users' containers first
        await prisma.container.deleteMany({
          where: { userId: { in: userIds } },
        });
        
        // Then delete the users
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
