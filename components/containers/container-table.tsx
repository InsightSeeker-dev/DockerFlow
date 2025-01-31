'use client';

import { Container as DockerContainer } from '@/lib/docker/types';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Trash2,
  Terminal,
  ExternalLink
} from 'lucide-react';

interface ContainerTableProps {
  containers: DockerContainer[];
  onRefresh: () => void;
  onStart?: (id: string) => void;
  onStop?: (id: string) => void;
  onDelete?: (id: string) => void;
  onLogs?: (id: string) => void;
}

export function ContainerTable({
  containers,
  onRefresh,
  onStart,
  onStop,
  onDelete,
  onLogs,
}: ContainerTableProps) {
  return (
    <div className="rounded-md border border-gray-800">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-800">
            <TableHead className="text-gray-400">Nom</TableHead>
            <TableHead className="text-gray-400">Image</TableHead>
            <TableHead className="text-gray-400">Statut</TableHead>
            <TableHead className="text-gray-400">Ports</TableHead>
            <TableHead className="text-gray-400">Créé le</TableHead>
            <TableHead className="text-gray-400 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {containers.map((container) => {
            const name = container.Names[0].replace(/^\//, '');
            const isRunning = container.State === 'running';
            const ports = container.customConfig?.ports || [];
            const createdDate = new Date(container.Created * 1000).toLocaleString();
            const subdomain = container.customConfig?.subdomain;

            return (
              <TableRow key={container.Id} className="border-gray-800">
                <TableCell className="font-medium text-gray-200">
                  {name}
                </TableCell>
                <TableCell className="text-gray-400">
                  {container.Image}
                </TableCell>
                <TableCell>
                  <StatusBadge status={container.State} />
                </TableCell>
                <TableCell className="text-gray-400">
                  {ports.map((port, index) => (
                    <div key={index}>
                      {port.hostPort}:{port.containerPort}/tcp
                    </div>
                  ))}
                </TableCell>
                <TableCell className="text-gray-400">
                  {createdDate}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center space-x-2">
                    {isRunning ? (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onStop?.(container.Id)}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onStart?.(container.Id)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onLogs?.(container.Id)}
                    >
                      <Terminal className="h-4 w-4" />
                    </Button>
                    {subdomain && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        asChild
                      >
                        <a
                          href={`https://${subdomain}.dockersphere.ovh`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => onDelete?.(container.Id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
