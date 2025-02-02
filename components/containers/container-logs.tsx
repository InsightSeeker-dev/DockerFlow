import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from 'lucide-react';

interface ContainerLogsProps {
  containerId: string | null;
  onClose: () => void;
}

export function ContainerLogs({ containerId, onClose }: ContainerLogsProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      if (!containerId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/containers/${containerId}/logs`);
        if (!response.ok) {
          throw new Error('Failed to fetch logs');
        }

        const data = await response.json();
        setLogs(data.logs);
      } catch (err) {
        setError('Impossible de récupérer les logs');
        console.error('Error fetching logs:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [containerId]);

  return (
    <Dialog open={!!containerId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Logs du conteneur</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 h-full p-4 rounded-md bg-gray-950 text-gray-100 font-mono text-sm">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-400 p-4">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-400 p-4">Aucun log disponible</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="py-1">
                {log}
              </div>
            ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}