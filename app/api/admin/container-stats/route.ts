import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Docker from 'dockerode';

const docker = new Docker();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer tous les conteneurs (running et stopped)
    const containers = await docker.listContainers({ all: true });

    // Calculer les statistiques
    const stats = {
      total: containers.length,
      running: containers.filter(c => c.State === 'running').length,
      stopped: containers.filter(c => c.State === 'exited').length,
      error: containers.filter(c => ['restarting', 'dead', 'created'].includes(c.State)).length
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching container stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch container statistics' },
      { status: 500 }
    );
  }
}
