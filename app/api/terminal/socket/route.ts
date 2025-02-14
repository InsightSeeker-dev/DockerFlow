import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserRole } from '@prisma/client'

let io: SocketIOServer | null = null

if (!io) {
  const httpServer = createServer()
  io = new SocketIOServer(httpServer, {
    path: '/api/terminal/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id)
  })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== UserRole.ADMIN) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const upgrade = req.headers.get('upgrade')
  if (upgrade?.toLowerCase() !== 'websocket') {
    return new NextResponse('Expected Websocket', { status: 426 })
  }

  try {
    const { socket, response } = await (req as any).socket.server.upgrade(req)
    return response
  } catch (error) {
    console.error('Socket upgrade error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}