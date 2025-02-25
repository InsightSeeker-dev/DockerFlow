'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2, RotateCcw, X } from 'lucide-react'
import 'xterm/css/xterm.css'

interface WebTerminalProps {
  containerId: string
  onClose?: () => void
}

const WebTerminal: React.FC<WebTerminalProps> = ({ containerId, onClose }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal>()
  const fitAddon = useRef<FitAddon>()
  const ws = useRef<WebSocket>()
  const [isConnected, setIsConnected] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const mountedRef = useRef(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 2000

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    if (ws.current) {
      ws.current.onclose = null
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.close()
      }
      ws.current = undefined
    }
    setIsConnected(false)
  }, [])

  const initializeTerminal = useCallback(async () => {
    if (!terminalRef.current || !mountedRef.current) return null

    try {
      cleanup()
      terminalRef.current.innerHTML = ''

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'monospace',
        theme: {
          background: '#1a1b26',
          foreground: '#a9b1d6',
          cursor: '#c0caf5',
          selectionBackground: '#273747'
        },
        allowTransparency: true,
        convertEol: true,
        scrollback: 1000,
        disableStdin: false
      })

      const fit = new FitAddon()
      term.loadAddon(fit)

      await new Promise(resolve => setTimeout(resolve, 100))
      term.open(terminalRef.current)
      await new Promise(resolve => setTimeout(resolve, 100))
      fit.fit()

      terminal.current = term
      fitAddon.current = fit

      if (mountedRef.current) {
        setIsLoading(false)
      }

      return { term, fit }
    } catch (error) {
      console.error('Error initializing terminal:', error)
      if (mountedRef.current) {
        toast.error('Erreur lors de l\'initialisation du terminal')
        setIsLoading(false)
      }
      return null
    }
  }, [cleanup])

  const connectWebSocket = useCallback(async (term: Terminal) => {
    if (!mountedRef.current) return

    cleanup()

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/terminal?containerId=${containerId}`
      
      const socket = new WebSocket(wsUrl)
      let pingInterval: NodeJS.Timeout

      socket.binaryType = 'arraybuffer'

      socket.onopen = () => {
        if (mountedRef.current) {
          setIsConnected(true)
          reconnectAttempts.current = 0
          term.clear()
          term.write('🚀 Terminal connecté\r\n')

          pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send('\0')
            }
          }, 30000)
        }
      }

      socket.onclose = (event) => {
        if (pingInterval) {
          clearInterval(pingInterval)
        }

        if (mountedRef.current) {
          setIsConnected(false)
          term.write('\r\n❌ Connexion fermée\r\n')

          if (!event.wasClean && reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++
            term.write(`\r\nTentative de reconnexion ${reconnectAttempts.current}/${maxReconnectAttempts}...\r\n`)
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                connectWebSocket(term)
              }
            }, reconnectDelay * Math.pow(2, reconnectAttempts.current - 1))
          } else if (reconnectAttempts.current >= maxReconnectAttempts) {
            term.write('\r\n❌ Échec de la reconnexion après plusieurs tentatives.\r\n')
            toast.error('La connexion au terminal a échoué')
          }
        }
      }

      socket.onerror = (error) => {
        console.error('WebSocket error:', error)
        if (mountedRef.current) {
          term.write('\r\n⚠️ Erreur de connexion\r\n')
        }
      }

      socket.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          if (event.data === '\0') {
            socket.send('\0')
            return
          }

          const data = event.data instanceof ArrayBuffer
            ? new TextDecoder().decode(event.data)
            : event.data

          term.write(data)
        } catch (error) {
          console.error('Error processing message:', error)
        }
      }

      term.onData(data => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: 'command', command: data }))
          } catch (error) {
            console.error('Error sending command:', error)
          }
        }
      })

      term.onResize(size => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({
              type: 'resize',
              cols: size.cols,
              rows: size.rows
            }))
          } catch (error) {
            console.error('Error sending resize:', error)
          }
        }
      })

      ws.current = socket
    } catch (error) {
      console.error('Error connecting WebSocket:', error)
      if (mountedRef.current) {
        toast.error('Erreur de connexion au WebSocket')
      }
    }
  }, [containerId, cleanup])

  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      const result = await initializeTerminal()
      if (result && mountedRef.current) {
        const { term, fit } = result
        await connectWebSocket(term)

        const handleResize = () => {
          if (mountedRef.current && fit) {
            try {
              fit.fit()
            } catch (error) {
              console.warn('Resize error:', error)
            }
          }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
      }
    }

    init()

    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [cleanup, connectWebSocket, initializeTerminal])

  const handleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev)
    setTimeout(() => {
      if (mountedRef.current && fitAddon.current) {
        try {
          fitAddon.current.fit()
        } catch (error) {
          console.warn('Fullscreen fit error:', error)
        }
      }
    }, 100)
  }, [])

  const handleReconnect = useCallback(async () => {
    if (!mountedRef.current) return
    
    setIsLoading(true)
    reconnectAttempts.current = 0
    cleanup()
    
    const result = await initializeTerminal()
    if (result && mountedRef.current) {
      await connectWebSocket(result.term)
    }
    if (mountedRef.current) {
      setIsLoading(false)
    }
  }, [cleanup, connectWebSocket, initializeTerminal])

  return (
    <div className="relative h-[500px]">
      <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="text-sm text-muted-foreground">Chargement du terminal...</div>
          </div>
        )}
        <div className="absolute right-2 top-2 flex items-center gap-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReconnect}
            disabled={isLoading}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div 
          ref={terminalRef}
          className={`h-full w-full ${!isConnected ? 'opacity-50' : ''}`}
        />
      </div>
    </div>
  )
}

export default WebTerminal