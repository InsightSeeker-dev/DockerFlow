'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { SearchAddon } from 'xterm-addon-search'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'
import 'xterm/css/xterm.css'

interface WebTerminalProps {
  containerId?: string
}

const WebTerminal: React.FC<WebTerminalProps> = ({ containerId }): JSX.Element => {
  const { data: session } = useSession()
  const terminalRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const maxReconnectAttempts = 3
  const [isTerminalReady, setIsTerminalReady] = useState(false)

  // Initialiser le terminal
  useEffect(() => {
    if (!terminalRef.current || !containerId || terminalInstanceRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5'
      },
      allowProposedApi: true,
      convertEol: true,
      scrollback: 1000
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(new SearchAddon())

    terminalInstanceRef.current = term
    fitAddonRef.current = fitAddon

    try {
      term.open(terminalRef.current)
      
      requestAnimationFrame(() => {
        try {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit()
            setIsTerminalReady(true)
          }
        } catch (e) {
          console.error('Error during initial fit:', e)
        }
      })
    } catch (e) {
      console.error('Error opening terminal:', e)
      setError('Failed to initialize terminal')
    }

    return () => {
      term.dispose()
    }
  }, [containerId])

  // Gérer la connexion socket
  useEffect(() => {
    if (!isTerminalReady || !terminalInstanceRef.current || !containerId) return

    const term = terminalInstanceRef.current
    term.write('Connecting to terminal...\r\n')

    const socket = io({
      path: '/api/terminal/socket',
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 10000
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      setReconnectAttempts(0)
      term.write('\r\n🚀 Connected to terminal\r\n')
      socket.emit('terminal:start', { containerId })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      term.write('\r\n🔌 Disconnected from terminal. Attempting to reconnect...\r\n')
    })

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err)
      setReconnectAttempts(prev => prev + 1)
      term.write(`\r\n❌ Connection error: ${err.message}\r\n`)
      
      if (reconnectAttempts >= maxReconnectAttempts) {
        term.write('\r\n❌ Failed to connect after multiple attempts. Please refresh the page.\r\n')
        socket.close()
      }
    })

    socket.on('terminal:data', (data) => {
      term.write(data)
    })

    socket.on('terminal:error', (data) => {
      setError(data.message)
      term.write(`\r\n❌ Error: ${data.message}\r\n`)
    })

    term.onData((data) => {
      if (socket.connected) {
        socket.emit('terminal:input', data)
      }
    })

    return () => {
      socket.close()
    }
  }, [containerId, isTerminalReady, reconnectAttempts])

  // Gérer le redimensionnement
  useEffect(() => {
    if (!isTerminalReady || !terminalInstanceRef.current || !fitAddonRef.current) return

    const handleResize = () => {
      try {
        if (fitAddonRef.current && terminalInstanceRef.current && socketRef.current?.connected) {
          fitAddonRef.current.fit()
          socketRef.current.emit('terminal:resize', {
            rows: terminalInstanceRef.current.rows,
            cols: terminalInstanceRef.current.cols
          })
        }
      } catch (e) {
        console.error('Error during resize:', e)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isTerminalReady])

  // Nettoyage lors de la fermeture de la fenêtre
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={terminalRef} className="w-full h-full" />
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/90 text-white px-4 py-2 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}

export default WebTerminal