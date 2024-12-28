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
    console.log('Starting image build process...');
    
    // Vérifier l'authentification
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log('Authentication failed: No session');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        dockerImages: true,
      },
    });

    if (!user || user.role !== 'ADMIN') {
      console.log('Authorization failed: User is not admin');
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Vérifier les limites de ressources
    const totalImageSize = user.dockerImages.reduce((acc, img) => acc + img.size, 0);
    if (totalImageSize >= user.storageLimit) {
      console.log('Storage limit exceeded');
      return new NextResponse('Storage limit exceeded', { status: 400 });
    }

    // Vérifier le type de contenu
    const contentType = req.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      console.log('Invalid content type:', contentType);
      return new NextResponse('Invalid content type. Expected multipart/form-data', { 
        status: 400 
      });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
      console.log('Form data parsed successfully');
    } catch (error) {
      console.error('Error parsing form data:', error);
      return new NextResponse('Invalid form data', { status: 400 });
    }

    const dockerfile = formData.get('dockerfile') as Blob | null;
    const tag = formData.get('tag') as string | null;
    const contextFiles = formData.getAll('context') as File[];

    console.log('Received data:', {
      hasDockerfile: !!dockerfile,
      tag,
      contextFilesCount: contextFiles.length
    });

    if (!dockerfile || !tag) {
      console.log('Missing required fields:', { hasDockerfile: !!dockerfile, hasTag: !!tag });
      return new NextResponse('Dockerfile and tag are required', { status: 400 });
    }

    // Créer un dossier temporaire pour le build
    const buildId = uuidv4();
    const buildDir = path.join(process.cwd(), 'tmp', buildId);
    await fs.mkdir(buildDir, { recursive: true });
    console.log('Created build directory:', buildDir);

    try {
      // Écrire le Dockerfile
      const dockerfileContent = await dockerfile.text();
      const dockerfilePath = path.join(buildDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, dockerfileContent);
      console.log('Dockerfile written successfully');

      // Écrire les fichiers de contexte
      for (const file of contextFiles) {
        const filePath = path.join(buildDir, file.name);
        const content = await file.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(content));
        console.log('Context file written:', file.name);
      }

      const docker = new Docker();
      const encoder = new TextEncoder();

      return new Promise<NextResponse>(async (resolve, reject) => {
        try {
          const stream = new PassThrough();
          const readable = new ReadableStream({
            start(controller) {
              stream.on('data', chunk => {
                controller.enqueue(chunk);
              });
              stream.on('end', () => {
                controller.close();
              });
              stream.on('error', err => {
                controller.error(err);
              });
            }
          });

          console.log('Starting Docker build with options:', {
            tag,
            buildDir,
            contextFiles: contextFiles.map(f => f.name)
          });

          // Construire l'image
          const buildStream = await docker.buildImage({
            context: buildDir,
            src: ['Dockerfile', ...contextFiles.map(f => f.name)]
          }, {
            t: tag,
            dockerfile: 'Dockerfile'
          });

          docker.modem.followProgress(
            buildStream,
            async (err: Error | null, output: any[]) => {
              console.log('Build process completed');
              if (err) {
                console.error('Build error:', err);
                stream.write(encoder.encode(JSON.stringify({
                  error: true,
                  message: err.message
                }) + '\n'));
                stream.end();
              } else {
                try {
                  console.log('Getting image info...');
                  const image = await docker.getImage(tag).inspect();
                  
                  console.log('Creating database entry...');
                  await prisma.dockerImage.create({
                    data: {
                      userId: user.id,
                      name: tag.split(':')[0],
                      tag: tag.split(':')[1] || 'latest',
                      size: image.Size,
                    }
                  });

                  stream.write(encoder.encode(JSON.stringify({
                    success: true,
                    message: 'Build completed successfully',
                    imageInfo: {
                      id: image.Id,
                      size: image.Size,
                      created: image.Created,
                      tags: image.RepoTags,
                    }
                  }) + '\n'));
                  console.log('Build successful, image info sent');
                } catch (inspectError) {
                  console.error('Error inspecting built image:', inspectError);
                  stream.write(encoder.encode(JSON.stringify({
                    error: true,
                    message: 'Error inspecting built image'
                  }) + '\n'));
                }
                stream.end();
              }

              // Nettoyer le dossier temporaire
              try {
                await fs.rm(buildDir, { recursive: true });
                console.log('Build directory cleaned up');
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
                console.error('Build event error:', event.error);
                stream.write(encoder.encode(JSON.stringify({
                  error: true,
                  message: event.error
                }) + '\n'));
              } else if (event.status) {
                console.log('Build status:', event.status);
                stream.write(encoder.encode(JSON.stringify({
                  status: event.status,
                  progress: event.progress
                }) + '\n'));
              }
            }
          );

          resolve(new NextResponse(readable, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }));
        } catch (error) {
          console.error('Error in build process:', error);
          reject(error);
        }
      });

    } catch (error) {
      // Nettoyer en cas d'erreur
      try {
        await fs.rm(buildDir, { recursive: true });
        console.log('Build directory cleaned up after error');
      } catch {}
      throw error;
    }
  } catch (error) {
    console.error('Build error:', error);
    return new NextResponse(
      JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      { status: 500 }
    );
  }
}
