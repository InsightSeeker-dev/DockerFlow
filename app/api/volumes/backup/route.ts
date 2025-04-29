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

// Validation stricte du nom de volume : lettres, chiffres, tirets, underscores uniquement
const backupSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, 'Nom de volume invalide'),
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

    // Récupérer le volume depuis la base de données et vérifier qu'il n'est pas supprimé
    const volume = await prisma.volume.findFirst({
      where: {
        name,
        userId: session.user.id,
        deletedAt: null // Ne pas autoriser les volumes supprimés
      }
    });

    if (!volume) {
      return NextResponse.json(
        { error: 'Volume not found in database or has been deleted' },
        { status: 404 }
      );
    }

    // Créer le répertoire de backup s'il n'existe pas
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Nom du fichier de backup avec timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `${name}_${timestamp}.tar`);

    console.log('--- [Backup] DÉBUT ---');
    console.log(`[Backup] Volume cible :`, name);
    console.log(`[Backup] Répertoire backup :`, BACKUP_DIR);
    console.log(`[Backup] Fichier backup cible :`, backupFile);

    // Vérifier que le volume existe et obtenir ses informations
    const volumeInfo = await docker.getVolume(name).inspect();
    console.log('[Backup] Infos volume Docker :', JSON.stringify(volumeInfo, null, 2));
    
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
    
    console.log('[Backup] Création du conteneur temporaire avec config :', JSON.stringify(containerConfig, null, 2));
    const container = await docker.createContainer(containerConfig);

    // Démarrer le conteneur et attendre qu'il finisse
    console.log('[Backup] Démarrage du conteneur de backup...');
    await container.start();
    
    // Récupérer les logs du conteneur
    const logs = await container.logs({stdout: true, stderr: true});
    console.log('[Backup] Logs du conteneur :\n', logs.toString());
    
    const result = await container.wait();
    console.log('[Backup] Code de sortie du conteneur :', result.StatusCode);
    
    // Vérifier si le conteneur s'est terminé avec succès
    if (result.StatusCode !== 0) {
      throw new Error(`Backup container exited with status ${result.StatusCode}`);
    }

    try {
      // Vérifier que le fichier de backup existe et n'est pas vide
      const stats = await fs.stat(backupFile);
      console.log('[Backup] Statut du fichier backup généré :', stats);
      if (stats.size === 0) {
        await fs.unlink(backupFile); // Supprimer le fichier vide
        console.error('[Backup] Le fichier backup est vide, suppression.');
        throw new Error('Backup file is empty');
      }
      console.log('[Backup] Fichier backup créé avec succès :', {
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
    console.log('[Backup] Enregistrement du backup en base de données...');
    const backup = await prisma.volumeBackup.create({
      data: {
        path: backupFile,
        userId: session.user.id,
        volumeId: volume.id,
        size: (await fs.stat(backupFile)).size
      }
    });
    console.log('[Backup] Backup enregistré en base avec l\'id :', backup.id);

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
    console.error('[Backup] ERREUR lors du backup :', error);
    return NextResponse.json(
      { error: 'Failed to create volume backup', details: error instanceof Error ? error.message : error },
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