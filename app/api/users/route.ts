import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/email";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        status: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        _count: {
          select: {
            containers: true,
          },
        },
      },
    });

    const formattedUsers = users.map(user => ({
      ...user,
      name: user.name || '',  
      role: user.role as 'ADMIN' | 'USER',
      status: user.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
      _count: user._count || { containers: 0 },
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { 
      name, 
      email, 
      password, 
      role,
      bio,
      defaultRegistry,
      autoUpdate,
      resourceLimits,
      notifications,
      cpuLimit,
      memoryLimit,
      storageLimit,
      cpuThreshold,
      memoryThreshold,
      storageThreshold
    } = body;

    // Validation
    if (!name || !email || !password || !role) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Validate resource limits
    if (cpuLimit && (cpuLimit < 1000 || cpuLimit > 8000)) {
      return new NextResponse('CPU limit must be between 1000 and 8000', { status: 400 });
    }

    if (memoryLimit && (memoryLimit < 1073741824 || memoryLimit > 17179869184)) {
      return new NextResponse('Memory limit must be between 1GB and 16GB', { status: 400 });
    }

    if (storageLimit && (storageLimit < 10737418240 || storageLimit > 214748364800)) {
      return new NextResponse('Storage limit must be between 10GB and 200GB', { status: 400 });
    }

    // Generate username from email
    const username = email.split('@')[0];

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return new NextResponse('Email already exists', { status: 400 });
      }
      if (existingUser.username === username) {
        return new NextResponse('Username already exists', { status: 400 });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with default values based on role
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        role,
        status: 'INACTIVE',
        bio: bio || null,
        defaultRegistry: defaultRegistry || 'docker.io',
        autoUpdate: autoUpdate ?? true,
        resourceLimits: resourceLimits || null,
        notifications: notifications || null,
        cpuLimit: cpuLimit || (role === 'ADMIN' ? 4000 : 2000),
        memoryLimit: memoryLimit || (role === 'ADMIN' ? 8589934592 : 4294967296),
        storageLimit: storageLimit || (role === 'ADMIN' ? 107374182400 : 53687091200),
        cpuThreshold: cpuThreshold || 80,
        memoryThreshold: memoryThreshold || 85,
        storageThreshold: storageThreshold || 90
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        status: true,
        bio: true,
        defaultRegistry: true,
        autoUpdate: true,
        cpuLimit: true,
        memoryLimit: true,
        storageLimit: true,
        cpuThreshold: true,
        memoryThreshold: true,
        storageThreshold: true,
        createdAt: true,
        _count: {
          select: {
            containers: true,
          },
        },
      },
    });

    // Create verification token and send email
    const verificationToken = await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: crypto.randomBytes(32).toString('hex'),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    await sendVerificationEmail(email, verificationToken.token);

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
