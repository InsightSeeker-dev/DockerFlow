import { type Alert as PrismaAlert, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import nodemailer from 'nodemailer';

export interface AlertType {
  type: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  status?: 'pending' | 'resolved' | 'dismissed';
  acknowledged?: boolean;
}

export interface AlertThreshold {
  cpu: number;
  memory: number;
  storage: number;
}

const DEFAULT_THRESHOLDS: AlertThreshold = {
  cpu: 80, // 80% CPU usage
  memory: 85, // 85% memory usage
  storage: 90, // 90% storage usage
};

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export class NotificationService {
  private static instance: NotificationService;
  private listeners: Map<string, ((alert: PrismaAlert) => void)[]> = new Map();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async setThresholds(userId: string, thresholds: Partial<AlertThreshold>) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(thresholds.cpu !== undefined && { cpuThreshold: thresholds.cpu }),
          ...(thresholds.memory !== undefined && { memoryThreshold: thresholds.memory }),
          ...(thresholds.storage !== undefined && { storageThreshold: thresholds.storage }),
        },
      });
    } catch (error) {
      console.error('Failed to update user thresholds:', error);
      throw new Error('Failed to update alert thresholds');
    }
  }

  public async getThresholds(userId: string): Promise<AlertThreshold> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          cpuThreshold: true,
          memoryThreshold: true,
          storageThreshold: true,
        },
      });

      if (!user) {
        return { ...DEFAULT_THRESHOLDS };
      }

      return {
        cpu: user.cpuThreshold,
        memory: user.memoryThreshold,
        storage: user.storageThreshold,
      };
    } catch (error) {
      console.error('Failed to get user thresholds:', error);
      return { ...DEFAULT_THRESHOLDS };
    }
  }

  public async createAlert(
    userId: string,
    type: string,
    message: string,
    severity: string = 'info'
  ): Promise<PrismaAlert> {
    const alert = await prisma.alert.create({
      data: {
        userId,
        type,
        message,
        severity,
        status: 'pending',
        acknowledged: false,
      }
    });

    const listeners = this.listeners.get(userId) || [];
    listeners.forEach(listener => listener(alert));

    return alert;
  }

  public async sendEmailNotification(
    userId: string, 
    alert: PrismaAlert, 
    severity: string,
    currentValue: number
  ) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          email: true,
          cpuThreshold: true,
          memoryThreshold: true,
          storageThreshold: true,
        }
      });

      if (!user?.email) {
        console.error(`No email found for user ${userId}`);
        return;
      }

      const thresholds = {
        cpu: user.cpuThreshold,
        memory: user.memoryThreshold,
        storage: user.storageThreshold,
      };

      const threshold = thresholds[alert.type as keyof AlertThreshold] || 
                       DEFAULT_THRESHOLDS[alert.type as keyof AlertThreshold];

      const emailContent = `
        <h2>DockerFlow Alert</h2>
        <p><strong>Severity:</strong> ${severity}</p>
        <p><strong>Type:</strong> ${alert.type}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
        <p><strong>Current Value:</strong> ${currentValue}%</p>
        <p><strong>Threshold:</strong> ${threshold}%</p>
        <p><strong>Time:</strong> ${alert.timestamp.toLocaleString()}</p>
        <br>
        <p>Please check your DockerFlow dashboard for more details.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/alerts">View Alert</a></p>
      `;

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: `DockerFlow Alert: ${severity.toUpperCase()} - ${alert.type}`,
        html: emailContent,
      });

      console.log(`Email notification sent to ${user.email} for alert ${alert.id}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw new Error(`Failed to send email notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public subscribe(userId: string, callback: (alert: PrismaAlert) => void) {
    const listeners = this.listeners.get(userId) || [];
    listeners.push(callback);
    this.listeners.set(userId, listeners);
  }

  public unsubscribe(userId: string, callback: (alert: PrismaAlert) => void) {
    const listeners = this.listeners.get(userId) || [];
    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
      this.listeners.set(userId, listeners);
    }
  }

  private notifyListeners(userId: string, alert: PrismaAlert) {
    const listeners = this.listeners.get(userId) || [];
    listeners.forEach(listener => listener(alert));
  }
}

export const notificationService = NotificationService.getInstance();
