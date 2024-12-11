import { Activity, Cpu, Database, Terminal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Container } from '@/types/docker';

interface ContainerCardProps {
  container: Container;
  onAction: (containerId: string, action: 'start' | 'stop' | 'remove') => void;
}

export function ContainerCard({ container, onAction }: ContainerCardProps) {
  return (
    <Card className="p-4 bg-black/40 backdrop-blur-sm border-gray-800/50 hover:bg-gray-800/20 transition-all duration-200">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-medium text-white">{container.Names[0].slice(1)}</h3>
          <p className="text-sm text-gray-400">{container.Image}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            container.State === 'running'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {container.State}
        </span>
      </div>

      {/* Ports */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-2">Ports</p>
        <div className="flex flex-wrap gap-2">
          {container.Ports.map((port) => (
            <span
              key={`${port.PrivatePort}-${port.PublicPort}`}
              className="bg-gray-800/50 text-gray-300 px-2 py-1 rounded text-xs border border-gray-700/50"
            >
              {port.PrivatePort}
              {port.PublicPort && ` → ${port.PublicPort}`}
            </span>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-2">Resources</p>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Cpu className="h-4 w-4 text-blue-400 mr-2" />
            <span className="text-sm text-gray-300">0%</span>
          </div>
          <div className="flex items-center">
            <Database className="h-4 w-4 text-purple-400 mr-2" />
            <span className="text-sm text-gray-300">0 MB</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onAction(container.Id, container.State === 'running' ? 'stop' : 'start')}
        >
          <Activity className="h-4 w-4 mr-2" />
          {container.State === 'running' ? 'Stop' : 'Start'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <Terminal className="h-4 w-4 mr-2" />
          Terminal
        </Button>
      </div>
    </Card>
  );
}
