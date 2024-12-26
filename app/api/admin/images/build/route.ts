import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { PassThrough } from 'stream';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    // Vérifier l'authentification
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user || user.role !== 'ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { dockerfile, imageName } = await req.json();

    if (!dockerfile || !imageName) {
      return new NextResponse('Dockerfile and image name are required', { status: 400 });
    }

    // Créer un dossier temporaire pour le build
    const buildId = uuidv4();
    const buildDir = path.join(process.cwd(), 'tmp', buildId);
    await fs.mkdir(buildDir, { recursive: true });

    // Écrire le Dockerfile
    const dockerfilePath = path.join(buildDir, 'Dockerfile');
    await fs.writeFile(dockerfilePath, dockerfile);

    const docker = new Docker();
    const stream = new PassThrough();

    // Créer un encodeur de texte
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          controller.error(err);
        });
      },
    });

    try {
      // Construire l'image
      const buildStream = await docker.buildImage({
        context: buildDir,
        src: ['Dockerfile']
      }, {
        t: imageName,
        dockerfile: 'Dockerfile',
      });

      // Suivre la progression
      docker.modem.followProgress(
        buildStream,
        async (err: Error | null, output: any[]) => {
          if (err) {
            console.error('Build error:', err);
            stream.write(encoder.encode(JSON.stringify({
              error: true,
              message: err.message
            }) + '\n'));
          } else {
            stream.write(encoder.encode(JSON.stringify({
              success: true,
              message: 'Build completed successfully'
            }) + '\n'));
          }
          stream.end();

          // Nettoyer le dossier temporaire
          try {
            await fs.rm(buildDir, { recursive: true });
          } catch (e) {
            console.error('Failed to clean up build directory:', e);
          }
        },
        (event: any) => {
          if (event.stream) {
            stream.write(encoder.encode(JSON.stringify({
              stream: event.stream.trim()
            }) + '\n'));
          } else if (event.error) {
            stream.write(encoder.encode(JSON.stringify({
              error: true,
              message: event.error
            }) + '\n'));
          }
        }
      );

      return new NextResponse(readable);
    } catch (buildError: any) {
      console.error('Build error:', buildError);
      return new NextResponse(
        JSON.stringify({
          error: true,
          message: buildError.message || 'Failed to build image'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error: any) {
    console.error('General error:', error);
    return new NextResponse(
      JSON.stringify({
        error: true,
        message: error.message || 'Internal Server Error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
