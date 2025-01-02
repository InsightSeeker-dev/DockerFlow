import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import Docker from 'dockerode';
import { getDockerClient } from '@/lib/docker/client';

const pullImageSchema = z.object({
  image: z.string(),
  tag: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { image, tag } = pullImageSchema.parse(body);

    const docker = getDockerClient();
    const fullImageName = `${image}:${tag}`;

    // Créer un encodeur de texte pour transformer les objets en lignes JSON
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const pullStream = await docker.pull(fullImageName);

    // Suivre la progression du pull
    docker.modem.followProgress(
      pullStream,
      async (err: Error | null, output: any[]) => {
        if (err) {
          await writer.write(encoder.encode(JSON.stringify({ error: err.message }) + '\n'));
          await writer.close();
          return;
        }

        // Le pull est terminé avec succès
        await writer.write(encoder.encode(JSON.stringify({ status: 'Pull completed successfully' }) + '\n'));
        await writer.close();
      },
      async (event: any) => {
        // Envoyer les mises à jour de progression
        await writer.write(encoder.encode(JSON.stringify(event) + '\n'));
      }
    );

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Image pull error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pull image' },
      { status: 500 }
    );
  }
}