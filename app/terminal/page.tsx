'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const WebTerminal = dynamic(
  () => import('@/components/terminal/WebTerminal'),
  { ssr: false }
);

import { Suspense } from 'react';

export default function TerminalPage() {
  const { data: session } = useSession();

  if (!session?.user?.role || session.user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-muted-foreground">
          Only administrators can access the terminal.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><p className="text-lg text-muted-foreground">Loading terminal...</p></div>}>
      <TerminalContent />
    </Suspense>
  );
}

function TerminalContent() {
  const searchParams = useSearchParams();
  const containerId = searchParams.get('containerId');
  const containerName = searchParams.get('name');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mettre à jour le titre de la fenêtre
    if (containerName) {
      document.title = `Terminal - ${containerName}`;
    }
  }, [containerName]);

  if (!containerId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-muted-foreground">
          No container specified.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black p-1">
      <div className="h-full">
        <WebTerminal containerId={containerId} />
      </div>
    </div>
  );
}