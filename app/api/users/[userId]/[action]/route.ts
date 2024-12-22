import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(
  req: Request,
  { params }: { params: { userId: string; action: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { userId, action } = params;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // Handle different actions
    switch (action.toLowerCase()) {
      case 'suspend':
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'SUSPENDED' },
        });
        break;

      case 'activate':
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'ACTIVE' },
        });
        break;

      case 'delete':
        // Delete user's containers first
        await prisma.container.deleteMany({
          where: { userId },
        });
        
        // Then delete the user
        await prisma.user.delete({
          where: { id: userId },
        });
        break;

      case 'resetpassword':
        // This should trigger a password reset email
        // For now, we'll just return success
        break;

      default:
        return new NextResponse(`Invalid action: ${action}`, { status: 400 });
    }

    return new NextResponse('Action completed successfully');
  } catch (error) {
    console.error(`Error performing action ${params.action}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
