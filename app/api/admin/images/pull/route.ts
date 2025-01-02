import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { PassThrough } from 'stream';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ActivityType } from '@prisma/client';

function formatImageUrl(registry: string, imageUrl: string): string {
  // Nettoyer l'URL de l'image
  imageUrl = imageUrl.trim();

  // Si l'URL contient déjà le registre, la retourner telle quelle
  if (imageUrl.includes(registry)) {
    console.log('Image URL contains registry, using as is:', imageUrl);
    return imageUrl;
  }

  // Pour Docker Hub
  if (registry === 'docker.io') {
    // Si l'image contient déjà un slash, c'est une image d'utilisateur
    if (imageUrl.includes('/')) {
      console.log('Using user image from Docker Hub:', imageUrl);
      return imageUrl;
    }
    // Pour les images officielles, pas besoin de préfixe library/
    console.log('Using official Docker Hub image:', imageUrl);
    return imageUrl;
  }

  // Pour les autres registres, ajouter le préfixe
  const formattedUrl = `${registry}/${imageUrl}`;
  console.log('Formatted URL for custom registry:', formattedUrl);
  return formattedUrl;
}

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

    const { imageUrl, registry, auth } = await req.json();

    if (!imageUrl) {
      return new NextResponse('Image URL is required', { status: 400 });
    }

    const docker = new Docker();
    const stream = new PassThrough();

    // Créer un encodeur de texte pour transformer les objets en lignes JSON
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

    // Formater l'URL de l'image
    const formattedImageUrl = formatImageUrl(registry, imageUrl);
    console.log('Final image URL for pulling:', formattedImageUrl);

    // Configurer l'authentification
    let authconfig = undefined;
    
    // Si des credentials sont fournis, les utiliser
    if (auth?.username && auth?.password) {
      console.log('Using provided credentials for registry:', registry);
      authconfig = {
        username: auth.username,
        password: auth.password,
        serveraddress: registry === 'docker.io' ? 'https://index.docker.io/v1/' : registry
      };
    }
    // Sinon, pour Docker Hub, utiliser les credentials par défaut si disponibles
    else if (registry === 'docker.io') {
      const dockerHubUsername = process.env.DOCKER_HUB_USERNAME;
      const dockerHubPassword = process.env.DOCKER_HUB_PASSWORD;
      if (dockerHubUsername && dockerHubPassword) {
        console.log('Using default Docker Hub credentials');
        authconfig = {
          username: dockerHubUsername,
          password: dockerHubPassword,
          serveraddress: 'https://index.docker.io/v1/'
        };
      } else {
        console.log('No credentials available for Docker Hub');
      }
    }

    try {
      // Lancer le pull de l'image
      const pullStream = await docker.pull(formattedImageUrl, { authconfig });

      docker.modem.followProgress(
        pullStream,
        async (err: Error | null, output: any[]) => {
          if (err) {
            console.error('Error following pull progress:', err);
            stream.write(encoder.encode(JSON.stringify({ error: err.message }) + '\n'));
            return;
          }

          try {
            // Récupérer les informations de l'image
            const image = await docker.getImage(formattedImageUrl).inspect();

            // Créer l'entrée dans la base de données
            const dockerImage = await prisma.dockerImage.create({
              data: {
                userId: user.id,
                name: imageUrl,
                tag: formattedImageUrl.split(':')[1] || 'latest',
                size: image.Size,
                created: new Date(image.Created),
              },
            });

            // Enregistrer l'activité
            await prisma.activity.create({
              data: {
                type: ActivityType.IMAGE_PULL,
                description: `Pulled image: ${formattedImageUrl}`,
                userId: user.id,
                metadata: {
                  size: image.Size,
                  registry: registry,
                  tag: formattedImageUrl.split(':')[1] || 'latest'
                },
                ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
                userAgent: req.headers.get('user-agent') || undefined,
              },
            });

            stream.write(encoder.encode(JSON.stringify({ status: 'Image pulled successfully' }) + '\n'));
          } catch (error) {
            console.error('Error creating image record:', error);
            if (error instanceof Error) {
              stream.write(encoder.encode(JSON.stringify({ error: error.message }) + '\n'));
            } else {
              stream.write(encoder.encode(JSON.stringify({ error: 'Unknown error occurred' }) + '\n'));
            }
          }
        },
        (event: any) => {
          if (event.status) {
            stream.write(encoder.encode(JSON.stringify(event) + '\n'));
          }
          if (event.progress) {
            stream.write(encoder.encode(JSON.stringify(event) + '\n'));
          }
          if (event.error) {
            stream.write(encoder.encode(JSON.stringify({ error: event.error }) + '\n'));
          }
        }
      );

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });

    } catch (error) {
      console.error('Pull error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to pull image';
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('General error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
