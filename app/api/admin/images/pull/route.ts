import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { PassThrough } from 'stream';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
      // Créer les options de pull
      const pullOptions: any = {};
      if (authconfig) {
        pullOptions.authconfig = authconfig;
      }

      console.log('Pulling image with options:', {
        imageUrl: formattedImageUrl,
        hasAuth: !!authconfig
      });

      // Gérer le pull de l'image
      const pullStream = await docker.pull(formattedImageUrl, pullOptions);

      // Transformer le stream Docker en stream lisible
      docker.modem.followProgress(
        pullStream,
        (err: Error | null, output: any[]) => {
          if (err) {
            console.error('Docker pull error:', err);
            const errorMessage = JSON.stringify({
              error: true,
              message: err.message || 'Failed to pull image',
              details: err
            }) + '\n';
            stream.write(encoder.encode(errorMessage));
            stream.end();
          } else {
            console.log('Pull completed successfully');
            const successMessage = JSON.stringify({
              success: true,
              message: 'Image pulled successfully'
            }) + '\n';
            stream.write(encoder.encode(successMessage));
            stream.end();
          }
        },
        (event: any) => {
          const line = JSON.stringify(event) + '\n';
          stream.write(encoder.encode(line));
        }
      );

      // Retourner le stream comme réponse
      return new NextResponse(readable);
    } catch (pullError: any) {
      console.error('Pull error details:', {
        message: pullError.message,
        statusCode: pullError.statusCode,
        reason: pullError.reason,
        json: pullError.json
      });

      // Retourner une erreur plus détaillée
      return new NextResponse(
        JSON.stringify({
          error: true,
          message: pullError.message,
          statusCode: pullError.statusCode,
          reason: pullError.reason || 'Unknown error',
          details: pullError.json
        }),
        { 
          status: pullError.statusCode || 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  } catch (error: any) {
    console.error('General error:', error);
    return new NextResponse(
      JSON.stringify({
        error: true,
        message: error.message || 'Internal Server Error',
        details: error
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
