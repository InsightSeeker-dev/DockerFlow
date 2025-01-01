import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { PassThrough } from 'stream';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface BuildOptions {
  cache: boolean;
  platform: string;
  compress: boolean;
  pull: boolean;
}

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

    const formData = await req.formData();
    console.log('Form data parsed successfully');

    const dockerfile = formData.get('dockerfile') as Blob | null;
    const tag = formData.get('tag') as string | null;
    const imageName = formData.get('imageName') as string | null;
    const contextFiles = formData.getAll('files') as File[];
    const optionsStr = formData.get('options') as string | null;

    let buildOptions: BuildOptions = {
      cache: true,
      platform: 'linux/amd64',
      compress: true,
      pull: true
    };

    if (optionsStr) {
      try {
        const parsedOptions = JSON.parse(optionsStr);
        buildOptions = {
          ...buildOptions,
          ...parsedOptions
        };
        console.log('Build options parsed:', buildOptions);
      } catch (error) {
        console.error('Error parsing build options:', error);
      }
    }

    console.log('Received data:', {
      hasDockerfile: !!dockerfile,
      tag,
      imageName,
      contextFilesCount: contextFiles.length,
      buildOptions
    });

    if (!dockerfile || !tag || !imageName) {
      console.log('Missing required fields:', { hasDockerfile: !!dockerfile, hasTag: !!tag, hasImageName: !!imageName });
      return new NextResponse(
        JSON.stringify({
          error: true,
          message: 'Missing required fields: dockerfile, tag, or imageName'
        }),
        { status: 400 }
      );
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
            imageName,
            buildDir,
            contextFiles: contextFiles.map(f => f.name),
            buildOptions
          });

          // Construire l'image
          const buildStream = await docker.buildImage({
            context: buildDir,
            src: ['Dockerfile', ...contextFiles.map(f => f.name)]
          }, {
            t: `${imageName}:${tag}`,
            dockerfile: 'Dockerfile',
            nocache: !buildOptions.cache,
            platform: buildOptions.platform,
            compress: buildOptions.compress,
            pull: buildOptions.pull,
            buildargs: {},
            memory: 0,
            memswap: 0,
            cpushares: 0,
            cpusetcpus: ''
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
                  const image = await docker.getImage(`${imageName}:${tag}`).inspect();

                  console.log('Creating database entry...');
                  await prisma.dockerImage.create({
                    data: {
                      userId: user.id,
                      name: imageName,
                      tag: tag,
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
