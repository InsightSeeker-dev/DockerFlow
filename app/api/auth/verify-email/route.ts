import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Fonction commune pour la vérification
async function verifyEmail(token: string) {
  console.log('Verifying token:', token);

  // Chercher l'utilisateur avec ce token
  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
    },
  });

  if (!user) {
    console.log('No user found with token:', token);
    throw new Error('Invalid token');
  }

  // Vérifier si l'utilisateur est déjà vérifié
  if (user.emailVerified && user.status === 'active') {
    console.log('User already verified:', user.id);
    throw new Error('Email is already verified');
  }

  // Vérifier si le token n'est pas expiré
  if (user.verificationTokenExpires && new Date(user.verificationTokenExpires) < new Date()) {
    console.log('Token expired for user:', user.id);
    throw new Error('Verification link has expired');
  }

  try {
    // Mettre à jour l'utilisateur
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpires: null,
        status: 'active',
      },
    });

    console.log('User verified successfully:', user.id);
    return user;
  } catch (updateError) {
    console.error('Error updating user:', updateError);
    throw new Error('Failed to verify email');
  }
}

// Route GET pour la compatibilité avec les anciens liens
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth?error=Token is required`
      );
    }

    await verifyEmail(token);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth?success=Email verified successfully. You can now log in.`
    );
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth?error=${error instanceof Error ? error.message : 'Failed to verify email'}`
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

    await verifyEmail(token);
    return NextResponse.json(
      { message: 'Email verified successfully' },
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
