import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { z } from 'zod';

const createUserSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Username can only contain letters, numbers, spaces, and hyphens'),
  email: z
    .string()
    .min(5, 'Email must be at least 5 characters')
    .max(100, 'Email cannot exceed 100 characters')
    .email('Invalid email format'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  cpuLimit: z.number().min(100).max(2000).default(1000),
  memoryLimit: z.number().min(536870912).max(4294967296).default(2147483648),
  storageLimit: z.number().min(1073741824).max(53687091200).default(10737418240),
});

export async function POST(request: Request) {
  try {
    // Vérifier que l'utilisateur est un administrateur
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Valider les données d'entrée
    const result = createUserSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      
      return NextResponse.json(
        { errors },
        { status: 400 }
      );
    }

    const { username, email, password, cpuLimit, memoryLimit, storageLimit } = result.data;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return NextResponse.json(
        { error: `${field} already exists` },
        { status: 400 }
      );
    }

    // Créer l'utilisateur (basic user)
    const hashedPassword = await hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'USER',
        status: 'ACTIVE',
        cpuLimit,
        memoryLimit,
        storageLimit,
        cpuThreshold: 80,
        memoryThreshold: 85,
        storageThreshold: 90,
        emailVerified: new Date(), // Les utilisateurs créés par un admin sont automatiquement vérifiés
      },
    });

    // Envoyer l'email de bienvenue
    await sendEmail({
      to: email,
      subject: 'Welcome to DockerFlow',
      html: `
        <h1>Welcome to DockerFlow!</h1>
        <p>Your account has been created by an administrator.</p>
        <p>You can now log in using your email and password.</p>
        <p>Resource Limits:</p>
        <ul>
          <li>CPU: ${cpuLimit/1000} cores</li>
          <li>Memory: ${Math.round(memoryLimit/1024/1024/1024 * 100) / 100}GB</li>
          <li>Storage: ${Math.round(storageLimit/1024/1024/1024 * 100) / 100}GB</li>
        </ul>
      `,
    });

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({
      message: 'User created successfully',
      user: userWithoutPassword,
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
