import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Fonction commune pour la vérification
async function verifyEmail(token: string) {
  console.log('Verifying token:', token);

  // Chercher l'utilisateur avec ce token
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
    console.log('No user found with token:', token);
    throw new Error('Invalid verification link. Please request a new one.');
  }

  // Vérifier si l'utilisateur est déjà vérifié
  if (user.emailVerified) {
    console.log('User already verified:', user.id);
    throw new Error('Email is already verified. You can log in to your account.');
  }

  try {
    // Mettre à jour l'utilisateur et supprimer le token de vérification
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          status: "ACTIVE",
        },
      }),
      prisma.verificationToken.deleteMany({
        where: {
          userId: user.id,
        },
      }),
    ]);

    console.log('User verified successfully:', user.id);
    return user;
  } catch (updateError) {
    console.error('Error updating user:', updateError);
    throw new Error('Failed to verify email. Please try again later.');
  }
}

// Route GET pour la compatibilité avec les anciens liens
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    console.log('Received verification request with token:', token);
    console.log('Request URL:', request.url);

    if (!token) {
      console.log('Token missing in request');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-error?error=Verification token is missing`
      );
    }

    console.log('Starting email verification process');
    await verifyEmail(token);
    console.log('Email verification successful, redirecting to success page');
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-success`
    );
  } catch (error) {
    console.error('Verification error:', error);
    console.error('Full error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-error?error=${encodeURIComponent(error instanceof Error ? error.message : 'Failed to verify email')}`
    );
  }
}

// Route POST pour l'API
export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const user = await verifyEmail(token);
    return NextResponse.json(
      { 
        message: 'Email verified successfully',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify email' },
      { status: 400 }
    );
  }
}
