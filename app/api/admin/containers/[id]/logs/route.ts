import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tail = searchParams.get('tail') || '100';
    const since = searchParams.get('since') || '0';

    const container = docker.getContainer(params.id);
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail: parseInt(tail),
      since: parseInt(since),
      timestamps: true,
    });

    // Parser les logs pour séparer stdout et stderr
    const logs: Array<{
      timestamp: string;
      message: string;
      type: 'stdout' | 'stderr';
    }> = [];

    // Convertir le stream en string et parser les logs
    const logString = logStream.toString('utf8');
    const logLines = logString.split('\n');

    logLines.forEach(line => {
      if (line.trim()) {
        const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z) (.+)$/);
        if (match) {
          logs.push({
            timestamp: match[1],
            message: match[2],
            type: line[0] === '\u0001' ? 'stderr' : 'stdout'
          });
        }
      }
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error getting container logs:', error);
    return NextResponse.json(
      { error: 'Failed to get container logs' },
      { status: 500 }
    );
  }
}
