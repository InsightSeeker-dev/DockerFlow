import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { prisma } from './prisma';

export interface TerminalSession {
  id: string;
  containerId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  commandHistory: string[];
}

class TerminalManager extends EventEmitter {
  private static instance: TerminalManager;
  private docker: Docker;
  private activeSessions: Map<string, TerminalSession>;
  private readonly MAX_HISTORY_LENGTH = 100;

  private constructor() {
    super();
    this.docker = new Docker();
    this.activeSessions = new Map();
  }

  public static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  public async createSession(
    containerId: string,
    userId: string
  ): Promise<TerminalSession> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.inspect(); // Verify container exists

      const session: TerminalSession = {
        id: `${containerId}-${Date.now()}`,
        containerId,
        userId,
        startTime: new Date(),
        lastActivity: new Date(),
        commandHistory: [],
      };

      this.activeSessions.set(session.id, session);
      await this.saveSessionToDb(session);

      return session;
    } catch (error) {
      console.error('Error creating terminal session:', error);
      throw new Error('Failed to create terminal session');
    }
  }

  public async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      await this.saveSessionToDb(session);
      this.activeSessions.delete(sessionId);
      this.emit('sessionEnded', sessionId);
    }
  }

  public async addCommand(sessionId: string, command: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.commandHistory.push(command);
      if (session.commandHistory.length > this.MAX_HISTORY_LENGTH) {
        session.commandHistory.shift();
      }
      session.lastActivity = new Date();
      await this.saveSessionToDb(session);
    }
  }

  public async getSessionHistory(sessionId: string): Promise<string[]> {
    const session = this.activeSessions.get(sessionId);
    return session?.commandHistory || [];
  }

  public async getUserSessions(userId: string): Promise<TerminalSession[]> {
    const sessions = await prisma.terminalSession.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
      take: 10,
    });

    return sessions.map(session => ({
      id: session.id,
      containerId: session.containerId,
      userId: session.userId,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      commandHistory: session.commandHistory,
    }));
  }

  private async saveSessionToDb(session: TerminalSession): Promise<void> {
    try {
      await prisma.terminalSession.upsert({
        where: { id: session.id },
        update: {
          lastActivity: session.lastActivity,
          commandHistory: session.commandHistory,
        },
        create: {
          id: session.id,
          containerId: session.containerId,
          userId: session.userId,
          startTime: session.startTime,
          lastActivity: session.lastActivity,
          commandHistory: session.commandHistory,
        },
      });
    } catch (error) {
      console.error('Error saving terminal session:', error);
    }
  }

  public async getContainerInfo(containerId: string) {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return {
        id: info.Id,
        name: info.Name.replace(/^\//, ''),
        image: info.Config.Image,
        state: info.State,
        created: info.Created,
        ports: info.NetworkSettings.Ports,
        env: info.Config.Env,
      };
    } catch (error) {
      console.error('Error getting container info:', error);
      throw new Error('Failed to get container info');
    }
  }

  public async executeCommand(
    containerId: string,
    command: string[]
  ): Promise<{ stdout: string; stderr: string }> {
    try {
      const container = this.docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
      });

      const { output, stderr } = await exec.start({});
      return {
        stdout: output.toString(),
        stderr: stderr.toString(),
      };
    } catch (error) {
      console.error('Error executing command:', error);
      throw new Error('Failed to execute command');
    }
  }
}

export const terminalManager = TerminalManager.getInstance();
