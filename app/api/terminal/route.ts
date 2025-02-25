import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { TerminalManager } from '@/lib/terminal';

export const dynamic = 'force-dynamic';

if (!process.env.NEXT_PUBLIC_WEBSOCKET_URL) {
  console.warn('NEXT_PUBLIC_WEBSOCKET_URL is not defined in environment variables');
}

export async function GET(req: NextRequest) {
  try {
    const upgradeHeader = req.headers.get('upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected Websocket', { 
        status: 426,
        headers: {
          'Upgrade': 'WebSocket',
          'Connection': 'Upgrade'
        }
      });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user || !session.user.role || session.user.role !== UserRole.ADMIN) {
      return new Response('Unauthorized', { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const containerId = searchParams.get('containerId');

    if (!containerId) {
      return new Response('Container ID is required', { status: 400 });
    }

    const terminalManager = TerminalManager.getInstance();

    const isValid = await terminalManager.validateContainerAccess(containerId, session.user.id);
    if (!isValid) {
      return new Response('Invalid container access', { status: 403 });
    }

    const terminalSession = await terminalManager.createSession(containerId, session.user.id);
    if (!terminalSession) {
      return new Response('Failed to create terminal session', { status: 500 });
    }

    const { socket, response } = Reflect.get(req, 'socket');
    
    if (!socket) {
      return new Response('WebSocket connection required', { 
        status: 426,
        headers: {
          'Upgrade': 'WebSocket',
          'Connection': 'Upgrade'
        }
      });
    }

    const exec = await terminalManager.getExec(containerId, {
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ['/bin/bash']
    });

    const stream = await exec.start({
      Detach: false,
      hijack: true
    });

    let isAlive = true;

    // Gestion des données du conteneur vers le client
    stream.on('data', (chunk: Buffer) => {
      if (isAlive && socket.readyState === 1) {
        try {
          socket.send(chunk);
        } catch (error) {
          console.error('Error sending data to client:', error);
        }
      }
    });

    stream.on('error', (error: Error) => {
      console.error('Stream error:', error);
      if (isAlive && socket.readyState === 1) {
        try {
          socket.send(`\r\n⚠️ Error: ${error.message}\r\n`);
        } catch (sendError) {
          console.error('Error sending error message to client:', sendError);
        }
      }
    });

    // Gestion des messages du client vers le conteneur
    socket.on('message', async (data: Buffer | string) => {
      try {
        if (data === '\0') {
          if (isAlive && socket.readyState === 1) {
            socket.send('\0');
          }
          return;
        }

        const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
        
        switch (message.type) {
          case 'command':
            if (message.command && isAlive) {
              const result = await terminalManager.addCommand(terminalSession.id, message.command);
              if (result.success) {
                stream.write(message.command);
              } else {
                socket.send(`\r\n⚠️ Error: ${result.error}\r\n`);
              }
            }
            break;
          case 'resize':
            if (message.rows && message.cols && isAlive) {
              await exec.resize({
                h: message.rows,
                w: message.cols
              });
            }
            break;
          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Message handling error:', error);
        if (isAlive && socket.readyState === 1) {
          socket.send('\r\n⚠️ Invalid message format\r\n');
        }
      }
    });

    // Gestion de la fermeture
    socket.on('close', async () => {
      isAlive = false;
      try {
        stream.end();
        await terminalManager.endSession(terminalSession.id);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });

    // Configuration des en-têtes de réponse
    const responseHeaders = new Headers({
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'Sec-WebSocket-Accept': 'dummy', // Sera remplacé par le serveur
      'Sec-WebSocket-Version': '13'
    });

    return new Response(null, {
      status: 101,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Terminal connection error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
