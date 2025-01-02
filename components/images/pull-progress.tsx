'use client';

import { ScrollArea } from '@/components/ui/scroll-area';

interface PullProgressProps {
  messages: string[];
}

export function PullProgress({ messages }: PullProgressProps) {
  return (
    <ScrollArea className="h-[200px] w-full rounded-md border bg-muted p-4">
      <div className="space-y-1 font-mono text-sm">
        {messages.map((message, index) => {
          try {
            const event = JSON.parse(message);
            return (
              <div key={index} className="flex items-start space-x-2">
                {event.id && (
                  <span className="text-muted-foreground">
                    {event.id.substring(0, 12)}:
                  </span>
                )}
                <span>
                  {event.status}
                  {event.progress && ` ${event.progress}`}
                </span>
              </div>
            );
          } catch {
            return null;
          }
        })}
      </div>
    </ScrollArea>
  );
}
