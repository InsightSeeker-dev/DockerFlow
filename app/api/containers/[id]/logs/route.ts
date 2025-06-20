import { NextResponse } from 'next/server';
import { getDockerClient } from '@/lib/docker/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    console.log('[LOGS] Session:', session);
    
    if (!session?.user?.id) {
      console.warn('[LOGS] No user session');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Récupérer le conteneur Docker directement
    const docker = getDockerClient();
    const dockerContainer = docker.getContainer(params.id);

    let containerInfo;
    try {
      containerInfo = await dockerContainer.inspect();
      console.log('[LOGS] containerInfo:', containerInfo);
    } catch (error) {
      console.error('[LOGS] Docker inspect error:', error);
      return NextResponse.json(
        { error: 'Container not found', details: String(error) },
        { status: 404 }
      );
    }

    // Vérification des infos docker
    if (!containerInfo?.Name || !containerInfo?.Id) {
      console.error('[LOGS] containerInfo incomplet:', containerInfo);
      return NextResponse.json(
        { error: 'Container info incomplete', details: containerInfo },
        { status: 500 }
      );
    }

    let dbContainer;
    try {
      // 1. Recherche par name
      dbContainer = await prisma.container.findFirst({
        where: {
          name: containerInfo.Name.replace(/^\//, ''),
          OR: [
            { userId: session.user.id },
            { user: { role: 'ADMIN' } }
          ]
        }
      });
      // 2. Si non trouvé et containerInfo.Id existe, recherche par dockerId
      if (!dbContainer && containerInfo.Id) {
        dbContainer = await prisma.container.findFirst({
          where: {
            dockerId: containerInfo.Id,
            OR: [
              { userId: session.user.id },
              { user: { role: 'ADMIN' } }
            ]
          }
        });
      }
      console.log('[LOGS] dbContainer:', dbContainer);
    } catch (error) {
      console.error('[LOGS] Prisma DB error:', error);
      return NextResponse.json(
        { error: 'Database error', details: String(error) },
        { status: 500 }
      );
    }

    if (!dbContainer && session.user.role !== 'ADMIN') {
      console.warn('[LOGS] Access denied for user:', session.user.id);
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Récupérer les logs
    const logStream = await dockerContainer.logs({
      stdout: true,
      stderr: true,
      tail: 1000,
      timestamps: true,
      follow: false
    });

    // Convertir le stream en tableau de lignes
    const logs = logStream
      .toString('utf-8')
      .split('\n')
      .filter(Boolean)
      .map(line => {
        // Enlever les caractères de contrôle Docker
        const cleanLine = line.slice(8);
        return cleanLine;
      });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching container logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch container logs', details: String(error) },
      { status: 500 }
    );
  }
}