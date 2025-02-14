'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import 'xterm/css/xterm.css';

interface WebTerminalProps {
  containerId?: string;
}

const WebTerminal: React.FC<WebTerminalProps> = ({ containerId }) => {
  const { data: session } = useSession();
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (!isMounted || !terminalRef.current) return;

    try {
      console.log('Initializing terminal...');
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1a1b26',
          foreground: '#a9b1d6',
          cursor: '#c0caf5'
        }
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.loadAddon(searchAddon);

      console.log('Opening terminal...');
      term.open(terminalRef.current);
      fitAddon.fit();
      term.write('Connecting to terminal...\r\n');

      setTerminal(term);

      // Connexion WebSocket
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal${containerId ? `?containerId=${containerId}` : ''}`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        term.write('\r\n🚀 Connected to terminal\r\n');
        setError(null);
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        term.write('\r\n🔌 Disconnected from terminal\r\n');
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Failed to connect to terminal');
        term.write('\r\n❌ Error: Failed to connect to terminal\r\n');
      };

      socketRef.current = ws;

      // Input handling
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      const handleResize = () => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          const dimensions = term.rows + 'x' + term.cols;
          ws.send(`RESIZE:${dimensions}`);
        }
      };

      window.addEventListener('resize', handleResize);
      // Initial resize
      setTimeout(handleResize, 100);

      return () => {
        console.log('Cleaning up terminal...');
        term.dispose();
        ws.close();
        window.removeEventListener('resize', handleResize);
      };
    } catch (err) {
      console.error('Error initializing terminal:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize terminal');
    }
  }, [isMounted, containerId]);

  if (!isMounted) {
    return <div className="h-full w-full bg-black" />;
  }

  return (
    <div className="relative w-full h-full">
      <div ref={terminalRef} className="w-full h-full" />
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/90 text-white px-4 py-2 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default WebTerminal;
