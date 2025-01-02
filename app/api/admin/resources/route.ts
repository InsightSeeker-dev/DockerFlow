import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { UserRole } from '@prisma/client';

// Schema de validation pour la mise à jour des ressources
const updateResourcesSchema = z.object({
  userId: z.string(),
  cpuLimit: z.number().optional(),
  memoryLimit: z.number().optional(),
  storageLimit: z.number().optional(),
  cpuThreshold: z.number().min(0).max(100).optional(),
  memoryThreshold: z.number().min(0).max(100).optional(),
  storageThreshold: z.number().min(0).max(100).optional(),
});

// GET /api/admin/resources - Obtenir les ressources de tous les utilisateurs
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Si un userId est spécifié, retourner les ressources de cet utilisateur
    if (userId) {
      // Vérifier si l'utilisateur demande ses propres ressources ou est admin
      if (userId !== session.user.id && session.user.role !== UserRole.ADMIN) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const userResources = await getUserResources(userId);
      if (!userResources) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json(userResources);
    }

    // Si pas de userId, vérifier que l'utilisateur est admin pour voir toutes les ressources
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Récupérer les ressources de tous les utilisateurs
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        cpuLimit: true,
        memoryLimit: true,
        storageLimit: true,
        cpuThreshold: true,
        memoryThreshold: true,
        storageThreshold: true,
      },
    });

    // Récupérer l'utilisation des ressources pour chaque utilisateur
    const usersWithResources = await Promise.all(
      users.map(async (user) => {
        const resources = await getUserResources(user.id);
        return resources;
      })
    );

    return NextResponse.json(usersWithResources);
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/resources - Mettre à jour les ressources d'un utilisateur
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const validatedData = updateResourcesSchema.parse(data);

    const updatedUser = await prisma.user.update({
      where: { id: validatedData.userId },
      data: {
        ...(validatedData.cpuLimit !== undefined && { cpuLimit: validatedData.cpuLimit }),
        ...(validatedData.memoryLimit !== undefined && { memoryLimit: validatedData.memoryLimit }),
        ...(validatedData.storageLimit !== undefined && { storageLimit: validatedData.storageLimit }),
        ...(validatedData.cpuThreshold !== undefined && { cpuThreshold: validatedData.cpuThreshold }),
        ...(validatedData.memoryThreshold !== undefined && { memoryThreshold: validatedData.memoryThreshold }),
        ...(validatedData.storageThreshold !== undefined && { storageThreshold: validatedData.storageThreshold }),
      },
    });

    const resources = await getUserResources(updatedUser.id);
    return NextResponse.json(resources);
  } catch (error) {
    console.error('Error updating resources:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update resources' },
      { status: 500 }
    );
  }
}

// Fonction utilitaire pour récupérer les ressources d'un utilisateur
async function getUserResources(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      cpuLimit: true,
      memoryLimit: true,
      storageLimit: true,
      cpuThreshold: true,
      memoryThreshold: true,
      storageThreshold: true,
    },
  });

  if (!user) {
    return null;
  }

  // Calculer l'utilisation actuelle des ressources
  const containers = await prisma.container.findMany({
    where: { userId },
  });

  const cpuUsage = containers.reduce((acc, container) => acc + (container.cpuLimit || 0), 0);
  const memoryUsage = containers.reduce((acc, container) => acc + (container.memoryLimit || 0), 0);

  const storage = await prisma.userStorage.aggregate({
    where: { userId },
    _sum: { size: true },
  });

  const storageUsage = storage._sum.size || 0;

  return {
    ...user,
    cpuUsage,
    memoryUsage,
    storageUsage,
    cpuUsagePercent: user.cpuLimit ? (cpuUsage / user.cpuLimit) * 100 : 0,
    memoryUsagePercent: user.memoryLimit ? (memoryUsage / user.memoryLimit) * 100 : 0,
    storageUsagePercent: user.storageLimit ? (storageUsage / user.storageLimit) * 100 : 0,
  };
}
