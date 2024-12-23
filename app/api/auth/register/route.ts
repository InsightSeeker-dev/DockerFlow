import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email';
import { z } from 'zod';
import { UserRole, UserStatus, ActivityType } from '@prisma/client';
import { formatBytes } from '@/lib/utils';
import { logActivity } from '@/lib/activity';

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

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculer les limites de ressources
    const cpuLimit = accountType === 'pro' ? 4000 : 2000;
    const memoryLimit = accountType === 'pro' ? 8589934592 : 4294967296;
    const storageLimit = accountType === 'pro' ? 107374182400 : 53687091200;

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: accountType === 'pro' ? UserRole.ADMIN : UserRole.USER,
        status: UserStatus.INACTIVE,
        cpuLimit,
        memoryLimit,
        storageLimit,
        cpuThreshold: 80,
        memoryThreshold: 85,
        storageThreshold: 90,
      },
    });

    // Enregistrer l'activité de création de compte
    await logActivity({
      type: ActivityType.USER_REGISTER,
      description: `New user registered: ${username} (${accountType} account)`,
      userId: user.id,
      metadata: {
        accountType,
        cpuLimit: `${cpuLimit / 1000} cores`,
        memoryLimit: formatBytes(memoryLimit),
        storageLimit: formatBytes(storageLimit),
      },
    });

    // Créer le token de vérification
    const token = randomBytes(32).toString('hex');
    await prisma.verificationToken.create({
      data: {
        token,
        userId: user.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 heures
      },
    });

    // Préparer le contenu de l'email
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0070f3; text-align: center;">Welcome to DockerFlow!</h1>
        <p>Hello ${username},</p>
        <p>Thank you for creating a DockerFlow account. Your account has been created successfully with a ${accountType} plan.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Your Account Details</h2>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Username:</strong> ${username}</li>
            <li><strong>Account Type:</strong> ${accountType.toUpperCase()}</li>
            <li><strong>Status:</strong> Pending Verification</li>
          </ul>
          
          <h3 style="color: #333;">Resource Limits</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>CPU:</strong> ${cpuLimit / 1000} cores</li>
            <li><strong>Memory:</strong> ${formatBytes(memoryLimit)}</li>
            <li><strong>Storage:</strong> ${formatBytes(storageLimit)}</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Your Email
          </a>
        </div>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Next Steps</h3>
          <ol style="padding-left: 20px;">
            <li>Click the verification button above</li>
            <li>Once verified, you can log in to your account</li>
            <li>Set up your profile and preferences</li>
            <li>Start managing your containers!</li>
          </ol>
        </div>

        <p style="color: #666; font-size: 0.9em;">
          This verification link will expire in 24 hours. If you did not create this account, 
          please ignore this email or contact our support team.
        </p>
      </div>
    `;

    // Envoyer l'email
    await sendEmail({
      to: email,
      subject: 'Welcome to DockerFlow - Verify Your Email',
      html: emailHtml,
    });

    return NextResponse.json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      redirect: '/auth/confirmation'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}