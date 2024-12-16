import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Vérifier si l'utilisateur demande ses propres ressources ou est admin
    if (params.id !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        cpuLimit: true,
        memoryLimit: true,
        storageLimit: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculer l'utilisation actuelle des ressources
    const containers = await prisma.container.findMany({
      where: { userId: params.id },
    });

    const cpuUsage = containers.reduce((acc, container) => acc + (container.cpuLimit || 0), 0);
    const memoryUsage = containers.reduce((acc, container) => acc + (container.memoryLimit || 0), 0);

    const storage = await prisma.userStorage.aggregate({
      where: { userId: params.id },
      _sum: { size: true },
    });

    const storageUsage = storage._sum.size || 0;

    return NextResponse.json({
      ...user,
      cpuUsage,
      memoryUsage,
      storageUsage,
    });
  } catch (error) {
    console.error('Error fetching user resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user resources' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Seul un admin peut modifier les limites de ressources
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const { cpuLimit, memoryLimit, storageLimit } = data;

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(cpuLimit !== undefined && { cpuLimit }),
        ...(memoryLimit !== undefined && { memoryLimit }),
        ...(storageLimit !== undefined && { storageLimit }),
      },
      select: {
        id: true,
        cpuLimit: true,
        memoryLimit: true,
        storageLimit: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user resources:', error);
    return NextResponse.json(
      { error: 'Failed to update user resources' },
      { status: 500 }
    );
  }
}
