import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { PassThrough } from 'stream';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ActivityType } from '@prisma/client';

export async function POST(req: NextRequest) {
  const buildDir = path.join(process.cwd(), 'tmp', uuidv4());
  
  try {
    // Vérifier l'authentification
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        dockerImages: true,
      },
    });

    if (!user || user.role !== 'ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Vérifier les limites de ressources
    const totalImageSize = user.dockerImages.reduce((acc, img) => acc + (img.size || 0), 0);
    if (totalImageSize >= user.storageLimit) {
      return new NextResponse('Storage limit exceeded', { status: 400 });
    }

    const formData = await req.formData();
    const dockerfile = formData.get('dockerfile');
    const tag = formData.get('tag') as string;
    const imageName = formData.get('imageName') as string;
    const files = formData.getAll('files');

    if (!dockerfile || !tag || !imageName) {
      return new NextResponse(
        'Missing required fields: dockerfile, tag, or imageName',
        { status: 400 }
      );
    }

    // Créer le dossier temporaire
    await fs.mkdir(buildDir, { recursive: true });

    // Écrire le Dockerfile
    let dockerfileContent: string;
    if (dockerfile instanceof Blob) {
      dockerfileContent = await dockerfile.text();
    } else {
      return new NextResponse('Invalid Dockerfile format', { status: 400 });
    }
    
    await fs.writeFile(path.join(buildDir, 'Dockerfile'), dockerfileContent);

    // Écrire les fichiers de contexte
    const contextFileNames: string[] = ['Dockerfile'];
    for (const file of files) {
      if (file instanceof Blob) {
        const fileName = (file as any).name || 'file';
        const content = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(path.join(buildDir, fileName), content);
        contextFileNames.push(fileName);
      }
    }

    const docker = new Docker();
    const buildStream = await docker.buildImage({
      context: buildDir,
      src: contextFileNames,
    }, {
      t: `${imageName}:${tag}`,
      dockerfile: 'Dockerfile',
    });

    return new Response(
      new ReadableStream({
        async start(controller) {
          await new Promise((resolve, reject) => {
            docker.modem.followProgress(
              buildStream,
              async (err: Error | null, output: any[]) => {
                if (err) {
                  controller.enqueue(`error: ${err.message}\n`);
                  controller.close();
                  reject(err);
                  return;
                }

                try {
                  const image = await docker.getImage(`${imageName}:${tag}`).inspect();
                  // Créer l'entrée de l'image dans la base de données
                  await prisma.dockerImage.create({
                    data: {
                      userId: user.id,
                      name: imageName,
                      tag: tag,
                      size: image.Size,
                      created: new Date(image.Created),
                    },
                  });

                  // Enregistrer l'activité de build
                  await prisma.activity.create({
                    data: {
                      type: ActivityType.IMAGE_BUILD,
                      description: `Built image: ${imageName}:${tag}`,
                      userId: user.id,
                      metadata: {
                        size: image.Size,
                        tag: tag
                      },
                      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
                      userAgent: req.headers.get('user-agent') || undefined,
                    },
                  });

                  controller.enqueue(`Successfully built ${imageName}:${tag}\n`);
                  controller.close();
                  resolve(true);
                } catch (error) {
                  console.error('Error creating image record:', error);
                  controller.enqueue(`Error creating image record: ${error}\n`);
                  controller.close();
                  reject(error);
                }
              },
              (event: any) => {
                if (event.stream) {
                  controller.enqueue(event.stream);
                } else if (event.error) {
                  controller.enqueue(`error: ${event.error}\n`);
                }
              }
            );
          });
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  } catch (error) {
    console.error('Build error:', error);
    return new NextResponse(
      JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      { status: 500 }
    );
  } finally {
    // Nettoyer le répertoire temporaire
    try {
      await fs.rm(buildDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up build directory:', error);
    }
  }
}
