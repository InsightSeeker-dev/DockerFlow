import React from 'react';
import { Clock, Terminal as TerminalIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface TerminalSession {
  id: string;
  containerId: string;
  startTime: Date;
  lastActivity: Date;
  commandHistory: string[];
}

interface SessionManagerProps {
  sessions: TerminalSession[];
  activeSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
}

const SessionManager: React.FC<SessionManagerProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCloseSession,
}) => {
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  const getTimeDifference = (date: Date) => {
    const diff = new Date().getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Clock className="h-4 w-4 mr-2" />
          Sessions
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Terminal Sessions</SheetTitle>
          <SheetDescription>
            Manage your active terminal sessions
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`
                p-4 rounded-lg border
                ${
                  session.id === activeSessionId
                    ? 'bg-primary/10 border-primary'
                    : 'bg-background border-border'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <TerminalIcon className="h-4 w-4 mr-2" />
                  <div>
                    <div className="font-medium">
                      Container: {session.containerId.slice(0, 12)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Started: {formatTime(session.startTime)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-muted-foreground">
                    {getTimeDifference(session.lastActivity)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCloseSession(session.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-sm text-muted-foreground">
                  Last commands:
                </div>
                <div className="mt-1 space-y-1">
                  {session.commandHistory.slice(-3).map((cmd, index) => (
                    <div
                      key={index}
                      className="text-sm font-mono bg-muted/50 rounded px-2 py-1"
                    >
                      $ {cmd}
                    </div>
                  ))}
                </div>
              </div>
              {session.id !== activeSessionId && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => onSelectSession(session.id)}
                >
                  Resume Session
                </Button>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No active sessions
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SessionManager;
