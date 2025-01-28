import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, UserStatus } from '@prisma/client';
import crypto from 'crypto';
import { userActivity } from '@/lib/activity';

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
        // Supprimer d'abord toutes les activités de l'utilisateur
        await prisma.activity.deleteMany({
          where: { userId },
        });

        // Supprimer les conteneurs de l'utilisateur
        await prisma.container.deleteMany({
          where: { userId },
        });
        
        // Supprimer les alertes de l'utilisateur
        await prisma.alert.deleteMany({
          where: { 
            OR: [
              { userId },
              { acknowledgedById: userId }
            ]
          },
        });

        // Supprimer les sessions du terminal
        await prisma.terminalSession.deleteMany({
          where: { userId },
        });

        // Supprimer les tokens de vérification
        await prisma.verificationToken.deleteMany({
          where: { userId },
        });

        // Enfin, supprimer l'utilisateur
        await prisma.user.delete({
          where: { id: userId },
        });
        break;

      case 'resetpassword':
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

        // Mettre à jour l'utilisateur avec le token de réinitialisation
        await prisma.user.update({
          where: { id: userId },
          data: {
            resetToken,
            resetTokenExpiry
          }
        });

        // Créer une activité pour la réinitialisation du mot de passe
        await userActivity.resetPassword(
          session.user.id,
          userId,
          {
            targetUsername: user.username
          }
        );

        // TODO: Envoyer un email avec le lien de réinitialisation
        // Le lien devrait être de la forme: /reset-password?token=${resetToken}

        return NextResponse.json({
          message: 'Password reset link has been sent to the user\'s email'
        });
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
