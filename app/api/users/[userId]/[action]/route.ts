import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, UserStatus } from '@prisma/client';

export async function POST(
  req: Request,
  { params }: { params: { userId: string; action: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Vérifier si l'utilisateur est admin ou agit sur son propre compte
    if (session.user.id !== params.userId && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
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
          data: { status: UserStatus.SUSPENDED },
        });
        break;

      case 'activate':
        await prisma.user.update({
          where: { id: userId },
          data: { status: UserStatus.ACTIVE },
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
