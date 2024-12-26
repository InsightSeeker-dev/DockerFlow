import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Docker from 'dockerode';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
  try {
    // Vérifier l'authentification
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Vérifier les permissions admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user || user.role !== 'ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { dockerfile, context } = await req.json();

    if (!dockerfile) {
      return new NextResponse('Dockerfile content is required', { status: 400 });
    }

    // Créer un répertoire temporaire pour le contexte de build
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docker-preview-'));

    try {
      // Écrire le Dockerfile
      await fs.writeFile(path.join(tmpDir, 'Dockerfile'), dockerfile);

      // Écrire les fichiers de contexte
      for (const file of context as { name: string; content: string }[]) {
        await fs.writeFile(path.join(tmpDir, file.name), file.content);
      }

      // Analyser le Dockerfile
      const docker = new Docker();
      const buildStream = await docker.buildImage(
        {
          context: tmpDir,
          src: ['Dockerfile', ...context.map((f: { name: string; content: string }) => f.name)],
        },
        {
          t: 'preview:latest',
          nocache: true,
          rm: true,
        }
      );

      // Attendre la fin du build
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(buildStream, (err: Error | null, output: any[]) => {
          if (err) reject(err);
          else resolve(output);
        });
      });

      // Inspecter l'image
      const image = await docker.getImage('preview:latest');
      const info = await image.inspect();

      // Supprimer l'image de prévisualisation
      await image.remove();

      return NextResponse.json({
        success: true,
        preview: {
          size: info.Size,
          created: info.Created,
          architecture: info.Architecture,
          os: info.Os,
          layers: info.RootFS.Layers,
          config: info.Config,
        },
      });
    } finally {
      // Nettoyer le répertoire temporaire
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Preview error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
