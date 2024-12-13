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

    const { username, email, password } = result.data;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (!existingUser.emailVerified) {
        console.log('User exists but not verified, sending new verification email');
        const verificationToken = randomBytes(32).toString('hex');
        
        // Mettre à jour le token
        await prisma.user.update({
          where: { email },
          data: { verificationToken }
        });

        // Envoyer un nouvel email de vérification
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;
        
        try {
          await sendEmail({
            to: email,
            subject: 'Verify your email for DockerFlow',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563eb;">Welcome to DockerFlow!</h1>
                <p>Please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" 
                     style="background-color: #2563eb; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 5px; display: inline-block;">
                    Verify Email
                  </a>
                </div>
                <p style="color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="color: #2563eb; word-break: break-all;">${verificationUrl}</p>
              </div>
            `,
          });
          console.log('Verification email sent successfully to:', email);
        } catch (error) {
          console.error('Error sending verification email:', error);
          throw new Error('Failed to send verification email');
        }

        return NextResponse.json(
          {
            message: 'A new verification email has been sent. Please check your inbox.',
            resendLink: true
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = randomBytes(32).toString('hex');

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        name: username,
        username,
        email,
        password: hashedPassword,
        verificationToken,
        role: 'admin',
        memoryLimit: 2 * 1024 * 1024 * 1024, // 2GB
        storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
      },
    });

    console.log('User created successfully:', user.id);

    // Envoyer l'email de vérification
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`;
    
    try {
      console.log('Sending verification email to new user:', email);
      await sendEmail({
        to: email,
        subject: 'Welcome to DockerFlow - Verify Your Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Welcome to DockerFlow!</h1>
            <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #2563eb; word-break: break-all;">${verificationUrl}</p>
          </div>
        `,
      });
      console.log('Verification email sent successfully to new user');
    } catch (error) {
      console.error('Error sending verification email:', error);
      // On continue l'inscription même si l'envoi d'email échoue
      console.log('Proceeding with registration despite email failure');
    }

    return NextResponse.json(
      { 
        message: 'Registration successful. Please check your email to verify your account.',
        userId: user.id
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
}