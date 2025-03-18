import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ActivityType } from '@prisma/client';
import fs from 'fs/promises';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Récupérer les informations du backup
    const backup = await prisma.volumeBackup.findUnique({
      where: { id: params.id },
      include: { volume: true }
    });

    if (!backup) {
      return NextResponse.json(
        { error: 'Backup not found' },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire du volume
    if (backup.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Supprimer le fichier de backup
    try {
      await fs.unlink(backup.path);
    } catch (error) {
      console.warn('Could not delete backup file:', error);
      // On continue même si le fichier n'existe pas
    }

    // Supprimer l'entrée de la base de données
    await prisma.volumeBackup.delete({
      where: { id: params.id }
    });

    // Enregistrer l'activité
    await prisma.activity.create({
      data: {
        type: ActivityType.VOLUME_BACKUP,
        userId: session.user.id,
        metadata: {
          action: 'delete',
          volumeName: backup.volume.name,
          backupId: backup.id
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting volume backup:', error);
    return NextResponse.json(
      { error: 'Failed to delete volume backup' },
      { status: 500 }
    );
  }
}
