import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

const docker = new Docker();

// Fonction pour créer un répertoire temporaire
async function createTempDir() {
  const tempDir = path.join(process.cwd(), 'tmp', uuidv4());
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

// Fonction pour nettoyer le répertoire temporaire
async function cleanupTempDir(tempDir: string) {
  try {
    await fs.rm(tempDir, { recursive: true });
  } catch (error) {
    console.error('Error cleaning up temp directory:', error);
  }
}

// Fonction pour sauvegarder les fichiers du contexte
async function saveContextFiles(formData: FormData, tempDir: string) {
  const dockerfile = formData.get('dockerfile') as Blob;
  if (!dockerfile) {
    throw new Error('Dockerfile is required');
  }

  // Sauvegarder le Dockerfile
  const dockerfileContent = await dockerfile.text();
  await fs.writeFile(path.join(tempDir, 'Dockerfile'), dockerfileContent);

  // Sauvegarder les fichiers du contexte
  const contextFiles = formData.getAll('context') as File[];
  for (const file of contextFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(tempDir, file.name), buffer);
  }
}

export async function POST(request: Request) {
  let tempDir: string | null = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Créer un répertoire temporaire pour le contexte de construction
    tempDir = await createTempDir();

    // Récupérer et parser le formData
    const formData = await request.formData();
    const tag = formData.get('tag') as string;

    if (!tag) {
      throw new Error('Tag is required');
    }

    // Sauvegarder les fichiers dans le répertoire temporaire
    await saveContextFiles(formData, tempDir);

    // Créer un stream pour la réponse
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Démarrer la construction de l'image
    const buildStream = await docker.buildImage({
      context: tempDir,
      src: await fs.readdir(tempDir),
    }, {
      t: tag,
      q: false,
      nocache: true,
      rm: true,
    });

    // Gérer le stream de construction
    docker.modem.followProgress(
      buildStream,
      async (err: Error | null) => {
        if (err) {
          await writer.write(
            new TextEncoder().encode(
              JSON.stringify({ error: err.message }) + '\n'
            )
          );
        }
        await writer.close();
        if (tempDir) {
          await cleanupTempDir(tempDir);
        }
      },
      async (event: any) => {
        try {
          await writer.write(
            new TextEncoder().encode(JSON.stringify(event) + '\n')
          );
        } catch (error) {
          console.error('Error writing to stream:', error);
        }
      }
    );

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error building image:', error);
    
    // Nettoyer le répertoire temporaire en cas d'erreur
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build image' },
      { status: 500 }
    );
  }
}
