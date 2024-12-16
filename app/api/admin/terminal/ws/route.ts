import { NextResponse } from 'next/server';
import { WebSocket } from 'ws';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const docker = new Docker();

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const containerId = searchParams.get('containerId');

  if (!containerId) {
    return NextResponse.json({ error: 'Container ID is required' }, { status: 400 });
  }

  try {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ['/bin/sh'],
    });

    const stream = await exec.start({
      hijack: true,
      stdin: true,
    });

    // Upgrade the HTTP connection to a WebSocket connection
    const { socket, response } = (await request as any).socket.server.upgrade(request);
    const ws = new WebSocket(null as any);
    ws.setSocket(socket);

    // Pipe container stream to WebSocket
    stream.on('data', (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    });

    // Pipe WebSocket to container stream
    ws.on('message', (msg: Buffer) => {
      stream.write(msg);
    });

    // Handle WebSocket close
    ws.on('close', () => {
      stream.end();
    });

    // Handle container stream end
    stream.on('end', () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    return response;
  } catch (error) {
    console.error('Terminal connection error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to container' },
      { status: 500 }
    );
  }
}
