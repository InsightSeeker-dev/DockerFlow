import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { docker } from '@/lib/docker';
import { isAdmin } from '@/lib/utils/auth-helpers';

export async function GET(
  request: Request,
  { params }: { params: { containerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tail = searchParams.get('tail') || '100';  // Nombre de lignes par défaut
    const since = searchParams.get('since') || '0';  // Timestamp de début

    const container = docker.getContainer(params.containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: parseInt(tail),
      since: parseInt(since),
      timestamps: true,
    });

    // Convertir le Buffer en chaînes de caractères et formater les logs
    const logLines = logs.toString('utf-8')
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => {
        // Les 8 premiers caractères indiquent le type de flux (stdout/stderr)
        const type = line[0] === '\u0001' ? 'stdout' : 'stderr';
        // Le reste est le message avec timestamp
        const content = line.slice(8);
        const [timestamp, ...messageParts] = content.split(' ');
        
        return {
          timestamp: new Date(timestamp).toISOString(),
          message: messageParts.join(' '),
          type
        };
      });

    return NextResponse.json(logLines);
  } catch (error) {
    console.error('[CONTAINER_LOGS]', error);
    return NextResponse.json(
      { error: 'Failed to fetch container logs' },
      { status: 500 }
    );
  }
}
