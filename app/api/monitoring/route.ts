import { NextResponse } from 'next/server';
import { resourceMonitor, ContainerStats, SystemStats } from '@/lib/monitoring';
import { WebSocket } from 'ws';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const clients = new Map<WebSocket, string>();

export function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const containerId = searchParams.get('containerId');
    const upgrade = req.headers.get('upgrade');

    if (upgrade?.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    clients.set(socket, session.user.id);

    socket.onopen = () => {
      console.log('Client connected');

      if (containerId) {
        // Monitoring d'un conteneur spécifique
        resourceMonitor.startMonitoring(containerId, (stats: ContainerStats) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(stats));
          }
        });
      } else {
        // Monitoring système global
        resourceMonitor.subscribeToSystem((stats: SystemStats) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(stats));
          }
        });
      }
    };

    socket.onclose = () => {
      console.log('Client disconnected');
      if (containerId) {
        resourceMonitor.stopMonitoring(containerId);
      }
      clients.delete(socket);
    };

    return response;
  } catch (error) {
    console.error('WebSocket error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Nettoyer les connexions à la fermeture du serveur
process.on('SIGTERM', () => {
  clients.forEach((_, socket) => {
    socket.close();
  });
});
