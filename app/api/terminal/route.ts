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
  const containerId = searchParams.get('containerId');
  const upgrade = req.headers.get('upgrade');

  if (upgrade?.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { status: 426 });
  }

  try {
    const { socket, response } = (await req as any).socket.server.upgrade(req);

    socket.onopen = async () => {
      console.log('Terminal client connected');

      try {
        // Si un containerId est fourni, on se connecte au conteneur
        if (containerId) {
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
            if (socket.readyState === 1) {
              socket.send(chunk.toString());
            }
          });

          socket.onmessage = (event: MessageEvent) => {
            const data = event.data.toString();
            if (data.startsWith('RESIZE:')) {
              const [rows, cols] = data.substring(7).split('x').map(Number);
              exec.resize({ h: rows, w: cols }).catch(console.error);
            } else {
              stream.write(data);
            }
          };

          socket.onclose = () => {
            stream.end();
            console.log('Terminal client disconnected');
          };
        } else {
          // Si pas de containerId, on se connecte à un conteneur par défaut
          const container = await docker.createContainer({
            Image: 'alpine:latest',
            Tty: true,
            OpenStdin: true,
            Cmd: ['/bin/sh'],
            HostConfig: {
              AutoRemove: true
            }
          });

          await container.start();

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
            if (socket.readyState === 1) {
              socket.send(chunk.toString());
            }
          });

          socket.onmessage = (event: MessageEvent) => {
            const data = event.data.toString();
            if (data.startsWith('RESIZE:')) {
              const [rows, cols] = data.substring(7).split('x').map(Number);
              exec.resize({ h: rows, w: cols }).catch(console.error);
            } else {
              stream.write(data);
            }
          };

          socket.onclose = () => {
            stream.end();
            container.stop().catch(console.error);
            console.log('Terminal client disconnected');
          };
        }
      } catch (error) {
        console.error('Failed to setup terminal:', error);
        socket.close();
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
