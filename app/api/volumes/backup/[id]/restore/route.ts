import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDockerClient } from '@/lib/docker';
import { prisma } from '@/lib/prisma';
import { ActivityType } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

export async function POST(
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

    // Vérifier que le fichier de backup existe
    if (!await fs.access(backup.path).then(() => true).catch(() => false)) {
      return NextResponse.json(
        { error: 'Backup file not found' },
        { status: 404 }
      );
    }

    const docker = await getDockerClient();
    const volumeName = backup.volume.name;

    // Créer un conteneur temporaire pour restaurer le backup
    const container = await docker.createContainer({
      Image: 'alpine',
      Cmd: ['tar', 'xf', `/backup/${path.basename(backup.path)}`, '-C', '/data'],
      HostConfig: {
        Binds: [
          `${volumeName}:/data`,
          `${path.dirname(backup.path)}:/backup:ro`
        ],
        AutoRemove: true
      }
    });

    // Démarrer le conteneur et attendre qu'il finisse
    await container.start();
    await container.wait();

    // Enregistrer l'activité
    await prisma.activity.create({
      data: {
        type: ActivityType.VOLUME_RESTORE,
        userId: session.user.id,
        metadata: {
          volumeName: volumeName,
          backupId: backup.id,
          backupPath: backup.path
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Volume ${volumeName} restored from backup`
    });
  } catch (error) {
    console.error('Error restoring volume backup:', error);
    return NextResponse.json(
      { error: 'Failed to restore volume backup' },
      { status: 500 }
    );
  }
}
