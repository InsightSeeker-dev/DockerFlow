import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { userActivity } from '@/lib/activity';

export async function PUT(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Vérifier si l'utilisateur est admin ou modifie son propre compte
    if (session.user.id !== params.userId && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { userId } = params;
    const data = await req.json();

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        defaultRegistry: true,
        autoUpdate: true,
        cpuLimit: true,
        memoryLimit: true,
        storageLimit: true,
        cpuThreshold: true,
        memoryThreshold: true,
        storageThreshold: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Préparer les données à mettre à jour
    const updateData: any = {};
    const allowedFields = [
      'username',
      'email',
      'defaultRegistry',
      'autoUpdate',
      'cpuLimit',
      'memoryLimit',
      'storageLimit',
      'cpuThreshold',
      'memoryThreshold',
      'storageThreshold'
    ];

    // Si l'utilisateur est admin, permettre la modification du rôle
    if (session.user.role === UserRole.ADMIN) {
      allowedFields.push('role');
    }

    // Filtrer les champs autorisés et vérifier les valeurs
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        // Validation spécifique pour certains champs
        switch (field) {
          case 'email':
            if (!data.email.includes('@')) {
              return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
              );
            }
            break;
          case 'username':
            if (data.username.length < 3) {
              return NextResponse.json(
                { error: 'Username must be at least 3 characters long' },
                { status: 400 }
              );
            }
            break;
          case 'cpuLimit':
          case 'memoryLimit':
          case 'storageLimit':
          case 'cpuThreshold':
          case 'memoryThreshold':
          case 'storageThreshold':
            if (typeof data[field] !== 'number' || data[field] < 0) {
              return NextResponse.json(
                { error: `Invalid ${field} value` },
                { status: 400 }
              );
            }
            break;
        }
        updateData[field] = data[field];
      }
    }

    // Si un mot de passe est fourni, le hasher
    if (data.password) {
      updateData.password = await hash(data.password, 10);
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        defaultRegistry: true,
        autoUpdate: true,
        cpuLimit: true,
        memoryLimit: true,
        storageLimit: true,
        cpuThreshold: true,
        memoryThreshold: true,
        storageThreshold: true
      }
    });

    // Créer une activité pour l'édition
    await userActivity.update(
      session.user.id,
      `User ${user.username} was updated`,
      {
        action: 'edit',
        targetUserId: userId,
        changes: Object.keys(updateData).reduce((acc: any, key) => {
          if (key !== 'password') {
            acc[key] = {
              from: user[key as keyof typeof user],
              to: updateData[key]
            };
          }
          return acc;
        }, {})
      }
    );

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Username or email already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
