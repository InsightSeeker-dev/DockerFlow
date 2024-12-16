import { NextResponse } from 'next/server';
import { WebSocket } from 'ws';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();
const clients = new Map<WebSocket, { containerId?: string; cleanup: () => void }>();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const containerId = searchParams.get('containerId');
  const upgrade = req.headers.get('upgrade');

  if (upgrade?.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

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
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(chunk.toString());
          }
        });

        socket.onmessage = (event) => {
          if (event.data.startsWith('RESIZE:')) {
            const [rows, cols] = event.data.substring(7).split('x').map(Number);
            exec.resize({ h: rows, w: cols }).catch(console.error);
          } else {
            stream.write(event.data);
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
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(data);
        }
      });

      socket.onmessage = (event) => {
        if (event.data.startsWith('RESIZE:')) {
          const [rows, cols] = event.data.substring(7).split('x').map(Number);
          pty.resize(cols, rows);
        } else {
          pty.write(event.data);
        }
      };

      cleanup = () => {
        pty.kill();
      };
    }

    clients.set(socket, { containerId, cleanup });
  };

  socket.onclose = () => {
    console.log('Terminal client disconnected');
    const client = clients.get(socket);
    if (client) {
      client.cleanup();
      clients.delete(socket);
    }
  };

  return response;
}

// Nettoyer les connexions à la fermeture du serveur
process.on('SIGTERM', () => {
  clients.forEach((client, socket) => {
    client.cleanup();
    socket.close();
  });
});
