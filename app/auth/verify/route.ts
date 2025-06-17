import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return new NextResponse('Missing token', { status: 400 });
    }

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return new NextResponse('Invalid token', { status: 400 });
    }

    // Vérifier si le token n'est pas expiré
    if (new Date() > new Date(verificationToken.expires)) {
      await prisma.verificationToken.delete({
        where: { token },
      });
      return new NextResponse('Token expired', { status: 400 });
    }

    // Mettre à jour l'utilisateur
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: {
        emailVerified: new Date(),
        status: UserStatus.ACTIVE,
      },
    });

    // Supprimer le token
    await prisma.verificationToken.delete({
      where: { token },
    });

    return NextResponse.redirect('/auth?verified=true');
  } catch (error) {
    console.error('[VERIFY_EMAIL]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
