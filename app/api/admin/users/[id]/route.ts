import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        containers: true,
        _count: {
          select: {
            containers: true,
            dockerImages: true,
            alerts: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
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
      role,
      status,
      cpuLimit,
      memoryLimit,
      storageLimit,
      cpuThreshold,
      memoryThreshold,
      storageThreshold,
    } = body;

    // Validate resource limits
    if (cpuLimit && (cpuLimit < 100 || cpuLimit > 4000)) {
      return NextResponse.json(
        { error: 'CPU limit must be between 100 and 4000 millicores' },
        { status: 400 }
      );
    }

    if (memoryLimit && (memoryLimit < 536870912 || memoryLimit > 8589934592)) {
      return NextResponse.json(
        { error: 'Memory limit must be between 512MB and 8GB' },
        { status: 400 }
      );
    }

    if (storageLimit && (storageLimit < 1073741824 || storageLimit > 107374182400)) {
      return NextResponse.json(
        { error: 'Storage limit must be between 1GB and 100GB' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (cpuLimit) updateData.cpuLimit = cpuLimit;
    if (memoryLimit) updateData.memoryLimit = memoryLimit;
    if (storageLimit) updateData.storageLimit = storageLimit;
    if (cpuThreshold) updateData.cpuThreshold = cpuThreshold;
    if (memoryThreshold) updateData.memoryThreshold = memoryThreshold;
    if (storageThreshold) updateData.storageThreshold = storageThreshold;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
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
            resourceUsage: true,
          },
        },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is trying to delete themselves
    if (session.user.id === params.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete all related resources first
    await prisma.$transaction([
      prisma.container.deleteMany({ where: { userId: params.id } }),
      prisma.resourceUsage.deleteMany({ where: { userId: params.id } }),
      prisma.user.delete({ where: { id: params.id } }),
    ]);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}