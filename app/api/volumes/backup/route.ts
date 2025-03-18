import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDockerClient } from '@/lib/docker';
import { dockerVolumeSync } from '@/lib/docker/volumeSync';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { ActivityType } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

const backupSchema = z.object({
  name: z.string().min(1),
});

// Répertoire de backup (à configurer selon l'environnement)
const BACKUP_DIR = process.env.VOLUME_BACKUP_DIR || '/var/lib/docker/backups';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = backupSchema.parse(body);

    // Vérifier si le volume existe
    const docker = await getDockerClient();
    try {
      await docker.getVolume(name).inspect();
    } catch (error) {
      return NextResponse.json(
        { error: 'Volume not found' },
        { status: 404 }
      );
    }

    // Créer le répertoire de backup s'il n'existe pas
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Nom du fichier de backup avec timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `${name}_${timestamp}.tar`);

    // Créer un conteneur temporaire pour faire le backup
    const container = await docker.createContainer({
      Image: 'alpine',
      Cmd: ['tar', 'cf', `/backup/${path.basename(backupFile)}`, '-C', '/data', '.'],
      HostConfig: {
        Binds: [
          `${name}:/data:ro`,
          `${BACKUP_DIR}:/backup`
        ],
        AutoRemove: true
      }
    });

    // Démarrer le conteneur et attendre qu'il finisse
    await container.start();
    await container.wait();

    // Enregistrer le backup dans la base de données
    const backup = await prisma.volumeBackup.create({
      data: {
        volumeName: name,
        path: backupFile,
        userId: session.user.id,
        size: (await fs.stat(backupFile)).size
      }
    });

    // Enregistrer l'activité
    await prisma.activity.create({
      data: {
        type: ActivityType.VOLUME_BACKUP,
        userId: session.user.id,
        details: {
          volumeName: name,
          backupPath: backupFile
        }
      }
    });

    return NextResponse.json({
      success: true,
      backup: {
        id: backup.id,
        volumeName: backup.volumeName,
        createdAt: backup.createdAt,
        size: backup.size
      }
    });
  } catch (error) {
    console.error('Error creating volume backup:', error);
    return NextResponse.json(
      { error: 'Failed to create volume backup' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Récupérer tous les backups de l'utilisateur
    const backups = await prisma.volumeBackup.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ backups });
  } catch (error) {
    console.error('Error fetching volume backups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch volume backups' },
      { status: 500 }
    );
  }
}
