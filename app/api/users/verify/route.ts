import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return new NextResponse('Verification token is required', { status: 400 });
    }

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: {
          gt: new Date(), // Token hasn't expired
        },
      },
    });

    if (!user) {
      return new NextResponse('Invalid or expired verification token', { status: 400 });
    }

    // Update user status and clear verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return new NextResponse('Email verified successfully');
  } catch (error) {
    console.error('Error verifying email:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
