import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email';
import { z } from 'zod';

// Schéma de validation amélioré
const registerSchema = z.object({
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
  accountType: z
    .enum(['pro', 'user'], {
      required_error: "Account type is required",
      invalid_type_error: "Account type must be either 'pro' or 'user'"
    })
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received registration request:', { 
      username: body.username, 
      email: body.email,
      passwordLength: body.password?.length 
    });

    // Valider les données d'entrée
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.issues.map((issue: z.ZodIssue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      
      console.log('Validation failed:', errors);
      return NextResponse.json(
        { errors },
        { status: 400 }
      );
    }

    const { username, email, password, accountType } = result.data;

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
      console.log(`${field} already exists:`, existingUser[field]);
      return NextResponse.json(
        { error: `${field} already exists` },
        { status: 400 }
      );
    }

    // Créer le token de vérification
    const verificationToken = randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        verificationToken,
        role: accountType === 'pro' ? 'admin' : 'user',
        status: 'active',
        cpuLimit: accountType === 'pro' ? 4000 : 2000, // 4 cores pour pro, 2 pour user
        memoryLimit: accountType === 'pro' ? 8589934592 : 4294967296, // 8GB pour pro, 4GB pour user
        storageLimit: accountType === 'pro' ? 107374182400 : 53687091200, // 100GB pour pro, 50GB pour user
        cpuThreshold: 80,
        memoryThreshold: 85,
        storageThreshold: 90,
      },
    });

    // Envoyer l'email de vérification
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${verificationToken}`;
    
    await sendEmail({
      to: email,
      subject: 'Welcome to DockerFlow - Verify Your Email',
      html: `
        <h1>Welcome to DockerFlow!</h1>
        <p>Your account has been created successfully.</p>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>Resource Limits:</p>
        <ul>
          <li>CPU: ${accountType === 'pro' ? '4 cores' : '2 cores'}</li>
          <li>Memory: ${accountType === 'pro' ? '8GB' : '4GB'}</li>
          <li>Storage: ${accountType === 'pro' ? '100GB' : '50GB'}</li>
        </ul>
        <p>As a ${accountType === 'pro' ? 'pro' : 'user'} user, you can:</p>
        <ul>
          <li>Create and manage containers</li>
          <li>Monitor system resources</li>
          <li>Configure system settings</li>
        </ul>
        <p>If you did not create this account, please ignore this email.</p>
      `,
    });

    console.log('User created successfully:', {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}