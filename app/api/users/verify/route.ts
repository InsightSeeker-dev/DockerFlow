import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return new NextResponse('Verification token is required', { status: 400 });
    }

    // Find verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        token: token
      },
      include: {
        user: true
      }
    });

    if (!verificationToken) {
      return new NextResponse('Invalid verification token', { status: 400 });
    }

    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id }
      });
      return new NextResponse('Verification token has expired', { status: 400 });
    }

    // Update user status and delete verification token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          status: 'ACTIVE',
          emailVerified: new Date()
        }
      }),
      prisma.verificationToken.delete({
        where: { id: verificationToken.id }
      })
    ]);

    return new NextResponse('Email verified successfully');
  } catch (error) {
    console.error('Error verifying email:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
