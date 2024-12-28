import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { sendEmail } from '@/lib/email';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            containers: true,
          },
        },
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      email,
      password,
      role = 'user',
      status = 'pending',
      cpuLimit = 1000,
      memoryLimit = 2147483648,
      storageLimit = 10737418240,
      cpuThreshold = 80,
      memoryThreshold = 85,
      storageThreshold = 90,
    } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 10);
    const username = email.split('@')[0];

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        role,
        status,
        cpuLimit,
        memoryLimit,
        storageLimit,
        cpuThreshold,
        memoryThreshold,
        storageThreshold,
        verificationToken,
        verificationTokenExpires,
      },
    });

    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;

    try {
      await sendEmail({
        to: email,
        subject: 'Vérifiez votre compte DockerFlow',
        html: `
          <h1>Bienvenue sur DockerFlow !</h1>
          <p>Votre compte a été créé avec succès par un administrateur.</p>
          <p>Pour activer votre compte, veuillez cliquer sur le lien ci-dessous :</p>
          <a href="${verificationUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Vérifier mon adresse email
          </a>
          <p>Ce lien expirera dans 24 heures.</p>
          <p>Vos limites de ressources :</p>
          <ul>
            <li>CPU : ${cpuLimit} millicores (${cpuLimit/1000} cores)</li>
            <li>Mémoire : ${Math.round(memoryLimit/1024/1024/1024 * 100) / 100}GB</li>
            <li>Stockage : ${Math.round(storageLimit/1024/1024/1024 * 100) / 100}GB</li>
          </ul>
          <p>Si vous n'avez pas demandé ce compte, vous pouvez ignorer cet email.</p>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Ne pas échouer la création de l'utilisateur si l'envoi de l'email échoue
    }

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}