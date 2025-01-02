import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserStatus } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Vérifier le token
    const user = await prisma.user.findFirst({
      where: {
        verificationTokens: {
          some: {
            token: token,
            expires: {
              gt: new Date(),
            },
          },
        },
      },
      include: {
        verificationTokens: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Mettre à jour l'utilisateur et supprimer le token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          status: UserStatus.ACTIVE,
        },
      }),
      prisma.verificationToken.deleteMany({
        where: {
          userId: user.id,
        },
      }),
    ]);

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}
