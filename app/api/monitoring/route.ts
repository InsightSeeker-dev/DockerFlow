import { NextResponse } from 'next/server';
import { resourceMonitor } from '@/lib/monitoring';
import type { ContainerStats, SystemStats, MonitoringError } from '@/lib/monitoring';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Map to store WebSocket clients
const clients = new Map<any, string>();

interface WebSocketMessage {
  containerId?: string;
  type?: 'start' | 'stop';
}

interface MessageEvent {
  data: string | Buffer;
  type: string;
  target: any;
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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

    const { socket, response } = (await req as any).socket.server.upgrade(req);
    clients.set(socket, session.user.id);

    socket.onopen = () => {
      console.log('WebSocket connection opened');

      if (containerId) {
        // Start monitoring specific container
        resourceMonitor.startMonitoring(containerId);
      }
    };

    socket.onmessage = async (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data.toString());
        if (message.containerId) {
          if (message.type === 'start') {
            resourceMonitor.startMonitoring(message.containerId);
          } else if (message.type === 'stop') {
            // Add logic to stop monitoring if needed
          } else {
            const stats = await resourceMonitor.getContainerStats(message.containerId);
            if (socket.readyState === 1) { // 1 = OPEN
              socket.send(JSON.stringify(stats));
            }
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        if (socket.readyState === 1) { // 1 = OPEN
          socket.send(JSON.stringify({ error: 'Failed to process message' }));
        }
      }
    };

    socket.onclose = () => {
      clients.delete(socket);
      console.log('WebSocket connection closed');
    };

    socket.onerror = (error: any) => {
      console.error('WebSocket error:', error);
      clients.delete(socket);
    };

    return response;
  } catch (error) {
    console.error('Error in WebSocket handler:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Clean up connections on server shutdown
process.on('SIGTERM', () => {
  clients.forEach((_, socket) => {
    socket.close();
  });
  clients.clear();
});
