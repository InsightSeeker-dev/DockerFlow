import React from 'react';
import { Command } from 'cmdk';
import { Button } from '@/components/ui/button';

interface QuickCommand {
  id: string;
  name: string;
  description: string;
  command: string;
}

const commonCommands: QuickCommand[] = [
  {
    id: 'ps',
    name: 'List Processes',
    description: 'Show running processes',
    command: 'ps aux',
  },
  {
    id: 'logs',
    name: 'View Logs',
    description: 'Show container logs',
    command: 'tail -f /var/log/*',
  },
  {
    id: 'disk',
    name: 'Disk Usage',
    description: 'Show disk usage',
    command: 'df -h',
  },
  {
    id: 'memory',
    name: 'Memory Usage',
    description: 'Show memory usage',
    command: 'free -h',
  },
  {
    id: 'network',
    name: 'Network Stats',
    description: 'Show network statistics',
    command: 'netstat -tulpn',
  },
];

interface CommandPaletteProps {
  onExecute: (command: string) => void;
  customCommands?: QuickCommand[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  onExecute,
  customCommands = [],
}) => {
  const [open, setOpen] = React.useState(false);
  const commands = [...commonCommands, ...customCommands];

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full text-left justify-between"
      >
        Quick Commands
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command Menu"
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[500px] rounded-lg bg-gray-800 text-white shadow-lg border border-gray-700"
      >
        <Command.Input
          placeholder="Type a command or search..."
          className="w-full px-4 py-3 bg-transparent border-b border-gray-700 text-white placeholder-gray-400 focus:outline-none"
        />
        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-gray-400">
            No commands found.
          </Command.Empty>
          {commands.map((cmd) => (
            <Command.Item
              key={cmd.id}
              value={cmd.name}
              onSelect={() => {
                onExecute(cmd.command);
                setOpen(false);
              }}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-3 text-sm outline-none hover:bg-gray-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <div>
                <div className="font-medium">{cmd.name}</div>
                <div className="text-xs text-gray-400">{cmd.description}</div>
                <div className="mt-1 text-xs font-mono text-gray-500">
                  $ {cmd.command}
                </div>
              </div>
            </Command.Item>
          ))}
        </Command.List>
      </Command.Dialog>
    </div>
  );
};

export default CommandPalette;
