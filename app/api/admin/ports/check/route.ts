import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import net from 'net';

// Vérifier si un port est disponible
const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
};

// Trouver le prochain port disponible
const findNextAvailablePort = async (startPort: number): Promise<number> => {
  let port = startPort;
  
  while (port < 65535) {
    const isAvailable = await isPortAvailable(port);
    if (isAvailable) {
      return port;
    }
    port++;
  }
  
  throw new Error('No available ports found');
};

export async function POST(req: NextRequest) {
  try {
    // Vérifier l'authentification
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user || user.role !== 'ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const { startPort } = await req.json();
    
    if (!startPort || typeof startPort !== 'number' || startPort < 1 || startPort > 65535) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid port number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Trouver le prochain port disponible
    const availablePort = await findNextAvailablePort(startPort);

    return new NextResponse(
      JSON.stringify({ port: availablePort }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error checking port availability:', error);
    return new NextResponse(
      JSON.stringify({
        error: true,
        message: error.message || 'Failed to check port availability'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
