'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TerminalProps {
  logs: string[];
  className?: string;
}

export function Terminal({ logs, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'font-mono text-sm bg-zinc-950 text-zinc-50 p-4 rounded-lg overflow-auto',
        className
      )}
    >
      {logs.map((log, index) => (
        <div key={index} className="whitespace-pre-wrap">
          <span className="text-zinc-500">{`[${index + 1}] `}</span>
          {log}
        </div>
      ))}
    </div>
  );
}
