import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Docker from 'dockerode';

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  host: process.env.DOCKER_HOST,
  port: process.env.DOCKER_PORT ? parseInt(process.env.DOCKER_PORT) : undefined,
  version: process.env.DOCKER_VERSION,
});

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Vérifier l'authentification
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tail = searchParams.get('tail') || '100';
    const since = searchParams.get('since') || '0';
    const timestamps = searchParams.get('timestamps') === 'true';

    const container = docker.getContainer(params.id);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: parseInt(tail),
      since: parseInt(since),
      timestamps,
    });

    // Convertir le Buffer en chaîne de caractères et séparer les lignes
    const logsString = logs.toString('utf-8');
    const logLines = logsString
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        // Détecter si c'est une erreur (stderr) en vérifiant le premier octet
        const isError = line.charCodeAt(0) === 2;
        const timestamp = timestamps ? line.slice(8, 30) : null;
        const message = timestamps ? line.slice(31) : line.slice(8);

        return {
          timestamp,
          message: message.trim(),
          type: isError ? 'error' : 'info',
        };
      });

    return NextResponse.json({
      containerId: params.id,
      logs: logLines,
    });
  } catch (error) {
    console.error('Error fetching container logs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch container logs',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}