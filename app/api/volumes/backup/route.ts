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

    // Récupérer le volume depuis la base de données
    const volume = await prisma.volume.findFirst({
      where: {
        name,
        userId: session.user.id
      }
    });

    if (!volume) {
      return NextResponse.json(
        { error: 'Volume not found in database' },
        { status: 404 }
      );
    }

    // Créer le répertoire de backup s'il n'existe pas
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Nom du fichier de backup avec timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `${name}_${timestamp}.tar`);

    console.log('Starting backup process for volume:', name);
    console.log('Backup directory:', BACKUP_DIR);
    
    // Vérifier que le volume existe et obtenir ses informations
    const volumeInfo = await docker.getVolume(name).inspect();
    console.log('Volume info:', volumeInfo);
    
    // Créer un conteneur temporaire pour faire le backup
    const containerConfig = {
      Image: 'alpine:latest',
      Cmd: ["/bin/sh", "-c", 
        `set -ex && ` +
        `ls -la /data && ` +
        `tar cvf /backup/${path.basename(backupFile)} -C /data . && ` +
        `ls -l /backup/${path.basename(backupFile)} && ` +
        `chown 1000:1000 /backup/${path.basename(backupFile)}`
      ],
      HostConfig: {
        Binds: [
          `${name}:/data:ro`,
          `${BACKUP_DIR}:/backup`
        ],
        AutoRemove: false // Désactiver l'auto-remove pour pouvoir inspecter les logs
      }
    };
    
    console.log('Creating backup container with config:', containerConfig);
    const container = await docker.createContainer(containerConfig);

    // Démarrer le conteneur et attendre qu'il finisse
    console.log('Starting backup container...');
    await container.start();
    
    // Récupérer les logs du conteneur
    const logs = await container.logs({stdout: true, stderr: true});
    console.log('Backup container logs:', logs.toString());
    
    const result = await container.wait();
    console.log('Backup container exit code:', result.StatusCode);
    
    // Vérifier si le conteneur s'est terminé avec succès
    if (result.StatusCode !== 0) {
      throw new Error(`Backup container exited with status ${result.StatusCode}`);
    }

    try {
      // Vérifier que le fichier de backup existe et n'est pas vide
      const stats = await fs.stat(backupFile);
      if (stats.size === 0) {
        await fs.unlink(backupFile); // Supprimer le fichier vide
        throw new Error('Backup file is empty');
      }
      console.log('Backup file created successfully:', {
        path: backupFile,
        size: stats.size
      });
    } finally {
      // Nettoyer le conteneur même en cas d'erreur
      try {
        await container.remove();
      } catch (removeError) {
        console.error('Error removing backup container:', removeError);
      }
    }

    // Enregistrer le backup dans la base de données
    const backup = await prisma.volumeBackup.create({
      data: {
        path: backupFile,
        userId: session.user.id,
        volumeId: volume.id,
        size: (await fs.stat(backupFile)).size
      }
    });

    // Enregistrer l'activité
    await prisma.activity.create({
      data: {
        type: ActivityType.VOLUME_BACKUP,
        userId: session.user.id,
        description: `Backup created for volume ${name}`,
        metadata: {
          backupPath: backupFile
        }
      }
    });

    return NextResponse.json({
      success: true,
      backup: {
        id: backup.id,
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