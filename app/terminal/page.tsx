'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Container } from '@prisma/client';
import WebTerminal from '@/components/terminal/WebTerminal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, Maximize2, Minimize2 } from 'lucide-react';

export default function TerminalPage() {
  const { data: session } = useSession();
  const [containers, setContainers] = useState<Container[]>([]);
  const [activeTerminals, setActiveTerminals] = useState<string[]>([]);
  const [maximizedTerminal, setMaximizedTerminal] = useState<string | null>(null);

  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const response = await fetch('/api/containers');
        if (!response.ok) throw new Error('Failed to fetch containers');
        const data = await response.json();
        setContainers(data.containers || []);
      } catch (error) {
        console.error('Error fetching containers:', error);
      }
    };

    if (session?.user?.role === 'ADMIN') {
      fetchContainers();
      // Rafraîchir la liste toutes les 30 secondes
      const interval = setInterval(fetchContainers, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const toggleTerminal = (containerId: string) => {
    setActiveTerminals(prev => 
      prev.includes(containerId) 
        ? prev.filter(id => id !== containerId)
        : [...prev, containerId]
    );
  };

  const toggleMaximize = (containerId: string) => {
    setMaximizedTerminal(prev => prev === containerId ? null : containerId);
  };

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg text-muted-foreground">
          Only administrators can access the terminal.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-6">Container Terminals</h2>
      
      {maximizedTerminal ? (
        <div className="fixed inset-0 z-50 bg-background p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">
              Terminal: {containers.find(c => c.id === maximizedTerminal)?.name || maximizedTerminal}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => toggleMaximize(maximizedTerminal)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-[calc(100vh-120px)]">
            <WebTerminal containerId={maximizedTerminal} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {containers.map((container) => (
            <Card key={container.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {container.name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleTerminal(container.id)}
                >
                  <Terminal className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2">
                  Status: <span className="font-semibold">{container.status}</span>
                </div>
                {activeTerminals.includes(container.id) && (
                  <div className="relative">
                    <div className="h-[300px] rounded-md overflow-hidden">
                      <WebTerminal containerId={container.id} />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => toggleMaximize(container.id)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}