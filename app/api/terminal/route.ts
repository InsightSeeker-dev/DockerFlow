import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';

const docker = new Docker();
const clients = new Map<any, { containerId?: string; cleanup: () => void }>();

interface MessageEvent {
  data: string | Buffer;
  type: string;
  target: any;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.ADMIN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawContainerId = searchParams.get('containerId');
  const containerId = rawContainerId || undefined; // Conversion de null en undefined
  const upgrade = req.headers.get('upgrade');

  if (upgrade?.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { status: 426 });
  }

  try {
    const { socket, response } = (await req as any).socket.server.upgrade(req);

    socket.onopen = async () => {
      console.log('Terminal client connected');

      let cleanup = () => {};

      if (containerId) {
        try {
          const container = docker.getContainer(containerId);
          const exec = await container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Cmd: ['/bin/sh']
          });

          const stream = await exec.start({
            hijack: true,
            stdin: true
          });

          stream.on('data', (chunk) => {
            if (socket.readyState === 1) { // OPEN
              socket.send(chunk.toString());
            }
          });

          socket.onmessage = (event: { data: string | Buffer; type: string }) => {
            const data = event.data.toString();
            if (data.startsWith('RESIZE:')) {
              const [rows, cols] = data.substring(7).split('x').map(Number);
              exec.resize({ h: rows, w: cols }).catch(console.error);
            } else {
              stream.write(data);
            }
          };

          cleanup = () => {
            stream.end();
          };
        } catch (error) {
          console.error('Failed to connect to container:', error);
          socket.close();
          return;
        }
      } else {
        // Terminal système par défaut
        const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
        const pty = require('node-pty').spawn(shell, [], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd: process.cwd(),
          env: process.env
        });

        pty.onData((data: string) => {
          if (socket.readyState === 1) { // OPEN
            socket.send(data);
          }
        });

        socket.onmessage = (event: { data: string | Buffer; type: string }) => {
          const data = event.data.toString();
          if (data.startsWith('RESIZE:')) {
            const [rows, cols] = data.substring(7).split('x').map(Number);
            pty.resize(cols, rows);
          } else {
            pty.write(data);
          }
        };

        cleanup = () => {
          pty.kill();
        };
      }

      clients.set(socket, { containerId, cleanup });
    };

    socket.onclose = () => {
      const client = clients.get(socket);
      if (client) {
        client.cleanup();
        clients.delete(socket);
      }
      console.log('Terminal client disconnected');
    };

    socket.onerror = (error: any) => {
      console.error('WebSocket error:', error);
      const client = clients.get(socket);
      if (client) {
        client.cleanup();
        clients.delete(socket);
      }
    };

    return response;
  } catch (error) {
    console.error('Error in terminal handler:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Nettoyer les connexions à la fermeture du serveur
process.on('SIGTERM', () => {
  clients.forEach((client, socket) => {
    client.cleanup();
    socket.close();
  });
  clients.clear();
});
