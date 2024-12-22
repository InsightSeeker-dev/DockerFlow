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
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            containers: true,
          },
        },
      },
    });

    return NextResponse.json(users);
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
    const { name, email, password, role } = body;

    // Validation
    if (!name || !email || !password || !role) {
      return new NextResponse('Missing required fields', { status: 400 });
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

    // Create user with INACTIVE status
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        role,
        status: 'INACTIVE',
        cpuLimit: role === 'ADMIN' ? 4000 : 2000,
        memoryLimit: role === 'ADMIN' ? 8589934592 : 4294967296,
        storageLimit: role === 'ADMIN' ? 107374182400 : 53687091200,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            containers: true,
          },
        },
      },
    });

    // Create verification token
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, token);
    } catch (error) {
      console.error('Error sending verification email:', error);
      // Ne pas bloquer la création de l'utilisateur si l'envoi de l'email échoue
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
