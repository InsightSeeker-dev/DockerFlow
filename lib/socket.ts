import { Server as SocketIOServer } from 'socket.io'
import { Server as NetServer } from 'http'
import { NextApiResponse } from 'next'
import { NextRequest } from 'next/server'
import Docker from 'dockerode'

const docker = new Docker()

export const config = {
  api: {
    bodyParser: false,
  },
}

interface SocketServer extends NetServer {
  io?: SocketIOServer
}

interface SocketWithIO extends NextRequest {
  socket: SocketServer
}

export function initSocket(req: SocketWithIO, res: NextApiResponse) {
  if (!req.socket.io) {
    const io = new SocketIOServer(req.socket.server as any, {
      path: '/api/terminal/socket',
      addTrailingSlash: false,
      transports: ['websocket'],
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['*'],
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    })

    io.on('connection', async (socket) => {
      console.log('Client connected to terminal')

      socket.on('terminal:start', async ({ containerId }) => {
        try {
          const container = containerId 
            ? docker.getContainer(containerId)
            : await docker.createContainer({
                Image: 'alpine:latest',
                Tty: true,
                OpenStdin: true,
                Cmd: ['/bin/sh'],
                HostConfig: {
                  AutoRemove: true
                }
              })

          if (!containerId) {
            await container.start()
          }

          const exec = await container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Cmd: ['/bin/sh']
          })

          const stream = await exec.start({
            hijack: true,
            stdin: true
          })

          stream.on('data', (chunk) => {
            socket.emit('terminal:data', chunk.toString())
          })

          socket.on('terminal:input', (data) => {
            stream.write(data)
          })

          socket.on('terminal:resize', ({ rows, cols }) => {
            exec.resize({ h: rows, w: cols }).catch(console.error)
          })

          socket.on('disconnect', () => {
            stream.end()
            if (!containerId) {
              container.stop().catch(console.error)
            }
            console.log('Client disconnected from terminal')
          })

          socket.on('error', (error) => {
            console.error('Socket error:', error)
            socket.emit('terminal:error', { message: 'Terminal connection error' })
          })
        } catch (error) {
          console.error('Terminal error:', error)
          socket.emit('terminal:error', { message: 'Failed to start terminal' })
        }
      })
    })

    req.socket.io = io
  }

  return req.socket.io
}

export function getIO(): SocketIOServer | null {
  return (global as any).io || null
}