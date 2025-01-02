import { NextResponse } from 'next/server';
import { WebSocket, ErrorEvent } from 'ws';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';

const docker = new Docker();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const containerId = searchParams.get('containerId');

    if (!containerId) {
      return NextResponse.json({ error: 'Container ID is required' }, { status: 400 });
    }

    if (request.headers.get("upgrade") !== "websocket") {
      return NextResponse.json({ error: 'Expected WebSocket' }, { status: 426 });
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
      
      // Pipe container stream to WebSocket
      stream.on('data', (chunk: Buffer) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(chunk);
        }
      });

      // Pipe WebSocket to container stream
      socket.on('message', (msg: Buffer) => {
        stream.write(msg);
      });

      socket.on('close', () => {
        stream.end();
      });

      socket.on('error', (error: ErrorEvent) => {
        console.error('WebSocket error:', error);
        stream.end();
      });

      // Handle container stream end
      stream.on('end', () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
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
  } catch (error) {
    console.error('Error in WebSocket connection:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
