import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { sendEmail } from '@/lib/email';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
      status = 'active',
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
      },
    });

    await sendEmail({
      to: email,
      subject: 'Welcome to DockerFlow',
      html: `
        <h1>Welcome to DockerFlow!</h1>
        <p>Your account has been created successfully.</p>
        <p>You can now log in using your email and password.</p>
        <p>Resource Limits:</p>
        <ul>
          <li>CPU: ${cpuLimit} millicores (${cpuLimit/1000} cores)</li>
          <li>Memory: ${Math.round(memoryLimit/1024/1024/1024 * 100) / 100}GB</li>
          <li>Storage: ${Math.round(storageLimit/1024/1024/1024 * 100) / 100}GB</li>
        </ul>
      `,
    });

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