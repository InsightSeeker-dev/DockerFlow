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

  useEffect(() => {
    if (terminalRef.current) {
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

      term.open(terminalRef.current);
      fitAddon.fit();

      setTerminal(term);

      // Connexion WebSocket
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal${containerId ? `?containerId=${containerId}` : ''}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        term.write('\r\n🚀 Connected to terminal\r\n');
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        setIsConnected(false);
        term.write('\r\n🔌 Disconnected from terminal\r\n');
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

      return () => {
        term.dispose();
        ws.close();
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [containerId]);

  return (
    <div className="w-full h-full min-h-[400px] bg-gray-900 rounded-lg overflow-hidden">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
};

export default WebTerminal;
