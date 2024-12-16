import { prisma } from './prisma';

export interface Alert {
  id: string;
  userId: string;
  type: 'cpu' | 'memory' | 'storage' | 'container';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  resourceId?: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  acknowledged: boolean;
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

export class NotificationService {
  private static instance: NotificationService;
  private listeners: Map<string, ((alert: Alert) => void)[]> = new Map();
  private thresholds: Map<string, AlertThreshold> = new Map();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public setThresholds(userId: string, thresholds: Partial<AlertThreshold>) {
    const currentThresholds = this.thresholds.get(userId) || { ...DEFAULT_THRESHOLDS };
    this.thresholds.set(userId, { ...currentThresholds, ...thresholds });
  }

  public getThresholds(userId: string): AlertThreshold {
    return this.thresholds.get(userId) || { ...DEFAULT_THRESHOLDS };
  }

  public async createAlert(
    userId: string,
    type: Alert['type'],
    severity: Alert['severity'],
    message: string,
    currentValue: number,
    resourceId?: string
  ) {
    const alert = await prisma.alert.create({
      data: {
        userId,
        type,
        severity,
        message,
        resourceId,
        threshold: this.thresholds.get(userId)?.[type] || DEFAULT_THRESHOLDS[type],
        currentValue,
        acknowledged: false,
      },
    });

    this.notifyListeners(userId, alert);
    await this.sendEmailNotification(alert);
    return alert;
  }

  private async sendEmailNotification(alert: Alert) {
    const user = await prisma.user.findUnique({
      where: { id: alert.userId },
    });

    if (!user || !user.email) return;

    // Vous pouvez utiliser votre service d'email existant ici
    const emailData = {
      to: user.email,
      subject: `DockerFlow Alert: ${alert.severity.toUpperCase()} - ${alert.type}`,
      text: `
        Resource Alert for DockerFlow
        
        Type: ${alert.type}
        Severity: ${alert.severity}
        Message: ${alert.message}
        Current Value: ${alert.currentValue}
        Threshold: ${alert.threshold}
        Time: ${alert.timestamp}
        
        Please check your DockerFlow dashboard for more details.
      `,
    };

    try {
      // Utiliser votre fonction d'envoi d'email
      // await sendEmail(emailData);
      console.log('Alert email sent:', emailData);
    } catch (error) {
      console.error('Failed to send alert email:', error);
    }
  }

  public async acknowledgeAlert(alertId: string, userId: string) {
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: { acknowledged: true },
    });

    this.notifyListeners(userId, alert);
    return alert;
  }

  public async getAlerts(userId: string, options: {
    acknowledged?: boolean;
    severity?: Alert['severity'];
    limit?: number;
  } = {}) {
    return prisma.alert.findMany({
      where: {
        userId,
        ...(options.acknowledged !== undefined && { acknowledged: options.acknowledged }),
        ...(options.severity && { severity: options.severity }),
      },
      orderBy: { timestamp: 'desc' },
      take: options.limit || 50,
    });
  }

  public subscribeToAlerts(userId: string, listener: (alert: Alert) => void) {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, []);
    }
    this.listeners.get(userId)?.push(listener);
  }

  public unsubscribeFromAlerts(userId: string, listener: (alert: Alert) => void) {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      const index = userListeners.indexOf(listener);
      if (index > -1) {
        userListeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(userId: string, alert: Alert) {
    this.listeners.get(userId)?.forEach(listener => listener(alert));
  }

  public checkResourceUsage(userId: string, stats: {
    cpu?: number;
    memory?: number;
    storage?: number;
  }) {
    const thresholds = this.getThresholds(userId);

    if (stats.cpu !== undefined && stats.cpu > thresholds.cpu) {
      this.createAlert(
        userId,
        'cpu',
        stats.cpu > thresholds.cpu + 10 ? 'critical' : 'warning',
        `CPU usage exceeds threshold: ${stats.cpu.toFixed(1)}%`,
        stats.cpu
      );
    }

    if (stats.memory !== undefined && stats.memory > thresholds.memory) {
      this.createAlert(
        userId,
        'memory',
        stats.memory > thresholds.memory + 10 ? 'critical' : 'warning',
        `Memory usage exceeds threshold: ${stats.memory.toFixed(1)}%`,
        stats.memory
      );
    }

    if (stats.storage !== undefined && stats.storage > thresholds.storage) {
      this.createAlert(
        userId,
        'storage',
        stats.storage > thresholds.storage + 5 ? 'critical' : 'warning',
        `Storage usage exceeds threshold: ${stats.storage.toFixed(1)}%`,
        stats.storage
      );
    }
  }
}

export const notificationService = NotificationService.getInstance();
