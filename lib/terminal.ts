import { PrismaClient, TerminalSession as PrismaTerminalSession, Prisma } from '@prisma/client';
import Docker from 'dockerode';

const prisma = new PrismaClient();

const TerminalSessionStatus = {
  ACTIVE: 'ACTIVE' as const,
  ENDED: 'ENDED' as const,
  EXPIRED: 'EXPIRED' as const
} as const;

interface TerminalSession {
  id: string;
  containerId: string;
  userId: string;
  startTime: Date;  // Correspond à 'created' dans Prisma
  lastActivity: Date;
  commandHistory: string[];
  commandCount: number;
  bytesSent: number;
  bytesReceived: number;
}

interface TerminalOptions {
  maxCommandSize?: number;
  sessionTimeout?: number;
  maxRetries?: number;
}

export class TerminalManager {
  private static instance: TerminalManager;
  private docker: Docker;
  private activeSessions: Map<string, TerminalSession>;
  private readonly MAX_COMMAND_SIZE: number;
  private readonly SESSION_TIMEOUT: number;
  private readonly MAX_RETRIES: number;
  private cleanupInterval: NodeJS.Timeout;

  public static getInstance(options?: TerminalOptions): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager(options);
    }
    return TerminalManager.instance;
  }

  private constructor(options?: TerminalOptions) {
    this.docker = new Docker();
    this.activeSessions = new Map();
    this.MAX_COMMAND_SIZE = options?.maxCommandSize || 1024 * 1024; // 1MB
    this.SESSION_TIMEOUT = options?.sessionTimeout || 2 * 60 * 60 * 1000; // 2 hours
    this.MAX_RETRIES = options?.maxRetries || 3;
    this.cleanupInterval = setInterval(() => this.cleanupInactiveSessions(), 5 * 60 * 1000);
    this.syncSessions().catch(console.error);
  }

  private async validateContainer(containerId: string, userId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Running && info.Config?.Labels?.['user.id'] === userId;
    } catch {
      return false;
    }
  }

  private async detectContainerShell(containerId: string): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const shells = ['/bin/bash', '/bin/sh', '/usr/bin/bash', '/usr/bin/sh'];
    
    for (const shell of shells) {
      try {
        const exec = await container.exec({
          Cmd: [shell, '-c', 'exit'],
          AttachStdout: true,
          AttachStderr: true,
        });
        const stream = await exec.start({});
        await new Promise((resolve) => stream.on('end', resolve));
        return shell;
      } catch {
        continue;
      }
    }
    throw new Error('No compatible shell found');
  }

  private validateCommand(command: string): boolean {
    return command.length <= this.MAX_COMMAND_SIZE && 
           !command.includes('\0') &&
           !/rm\s+-rf\s+\//.test(command); // Bloquer les commandes dangereuses
  }

  public async createSession(
    containerId: string,
    userId: string
  ): Promise<TerminalSession> {
    if (!(await this.validateContainer(containerId, userId))) {
      throw new Error('Invalid or unauthorized container');
    }

    await this.detectContainerShell(containerId);

    const session = await prisma.terminalSession.create({
      data: {
        userId,
        containerId,
        status: TerminalSessionStatus.ACTIVE,
        lastActivity: new Date()
      }
    });

    const terminalSession = {
      id: session.id,
      containerId,
      userId,
      startTime: session.created,
      lastActivity: session.lastActivity || session.created,
      commandHistory: [],
      commandCount: 0,
      bytesSent: 0,
      bytesReceived: 0
    };

    this.activeSessions.set(session.id, terminalSession);
    return terminalSession;
  }

  public async addCommand(
    sessionId: string,
    command: string
  ): Promise<{ success: boolean; error?: string }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!this.validateCommand(command)) {
      return { success: false, error: 'Invalid or dangerous command' };
    }

    try {
      session.commandHistory.push(command);
      session.commandCount++;
      session.bytesSent += Buffer.from(command).length;
      session.lastActivity = new Date();

      await prisma.terminalSession.update({
        where: { id: sessionId },
        data: {
          commandCount: { increment: 1 },
          bytesSent: { increment: Buffer.from(command).length },
          lastActivity: session.lastActivity,
          status: TerminalSessionStatus.ACTIVE
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating session command:', error);
      return { success: false, error: 'Failed to update session' };
    }
  }

  public async updateSessionActivity(
    sessionId: string,
    bytesReceived?: number
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      session.lastActivity = new Date();
      if (bytesReceived) {
        session.bytesReceived += bytesReceived;
      }

      await prisma.terminalSession.update({
        where: { id: sessionId },
        data: {
          lastActivity: session.lastActivity,
          bytesReceived: bytesReceived ? { increment: bytesReceived } : undefined,
          status: TerminalSessionStatus.ACTIVE
        }
      });
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  public async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      await prisma.terminalSession.update({
        where: { id: sessionId },
        data: {
          status: TerminalSessionStatus.ENDED,
          lastActivity: new Date()
        }
      });
    } finally {
      this.activeSessions.delete(sessionId);
    }
  }

  public async validateContainerAccess(containerId: string, userId: string): Promise<boolean> {
    return this.validateContainer(containerId, userId);
  }

  public async getExec(containerId: string, options: Docker.ExecCreateOptions): Promise<Docker.Exec> {
    try {
      const container = this.docker.getContainer(containerId);
      return await container.exec(options);
    } catch (error) {
      console.error('Error creating exec:', error);
      throw new Error('Failed to create exec instance');
    }
  }

  private async cleanupInactiveSessions(): Promise<void> {
    const now = new Date();
    const entries = Array.from(this.activeSessions.entries());
    
    for (const [sessionId, session] of entries) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      if (inactiveTime > this.SESSION_TIMEOUT) {
        await this.endSession(sessionId);
      }
    }
  }

  private async syncSessions(): Promise<void> {
    try {
      const activeSessions = await prisma.terminalSession.findMany({
        where: { status: TerminalSessionStatus.ACTIVE },
        select: {
          id: true,
          containerId: true,
          userId: true,
          created: true,
          lastActivity: true,
          commandCount: true,
          bytesSent: true,
          bytesReceived: true
        }
      });
      
      for (const session of activeSessions) {
        try {
          const isValid = await this.validateContainer(session.containerId, session.userId);
          if (!isValid) {
            await this.endSession(session.id);
            continue;
          }

          this.activeSessions.set(session.id, {
            id: session.id,
            containerId: session.containerId,
            userId: session.userId,
            startTime: session.created,
            lastActivity: session.lastActivity || session.created,
            commandHistory: [],
            commandCount: session.commandCount || 0,
            bytesSent: session.bytesSent || 0,
            bytesReceived: session.bytesReceived || 0
          });
        } catch (error) {
          console.error(`Error syncing session ${session.id}:`, error);
          await this.endSession(session.id);
        }
      }
    } catch (error) {
      console.error('Error syncing sessions:', error);
    }
  }

  public dispose(): void {
    clearInterval(this.cleanupInterval);
    this.activeSessions.clear();
  }
}
