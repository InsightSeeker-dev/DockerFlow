import { prisma } from './prisma';

export type AlertType = 'cpu' | 'memory' | 'storage' | 'container';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  userId: string;
  type: string;
  message: string;
  status: string;
  severity: AlertSeverity;
  acknowledged: boolean;
  created: Date;
  currentValue?: number;
  threshold?: number;
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
    type: AlertType,
    message: string,
    severity: AlertSeverity = 'info'
  ): Promise<Alert> {
    const alert = await prisma.alert.create({
      data: {
        userId,
        type,
        message,
        status: 'pending',
      },
    });

    const alertWithExtras: Alert = {
      id: alert.id,
      userId: alert.userId,
      type: alert.type,
      message: alert.message,
      status: alert.status,
      severity: severity,
      acknowledged: false,
      created: alert.created,
      currentValue: undefined,
      threshold: undefined,
    };

    const listeners = this.listeners.get(userId) || [];
    listeners.forEach((listener) => listener(alertWithExtras));

    return alertWithExtras;
  }

  private async sendEmailNotification(
    userId: string, 
    alert: Alert, 
    severity: AlertSeverity,
    currentValue: number
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.email) return;

    // Vous pouvez utiliser votre service d'email existant ici
    const emailData = {
      to: user.email,
      subject: `DockerFlow Alert: ${severity.toUpperCase()} - ${alert.type}`,
      text: `
        Resource Alert for DockerFlow
        
        Type: ${alert.type}
        Severity: ${severity}
        Message: ${alert.message}
        Current Value: ${currentValue}%
        Threshold: ${this.thresholds.get(userId)?.[alert.type as keyof AlertThreshold] || DEFAULT_THRESHOLDS[alert.type as keyof AlertThreshold]}%
        Time: ${alert.created}
        
        Please check your DockerFlow dashboard for more details.
      `,
    };

    // TODO: Implémenter l'envoi d'email
    console.log('Email would be sent:', emailData);
  }

  public subscribe(userId: string, callback: (alert: Alert) => void) {
    const userListeners = this.listeners.get(userId) || [];
    userListeners.push(callback);
    this.listeners.set(userId, userListeners);
  }

  public unsubscribe(userId: string, callback: (alert: Alert) => void) {
    const userListeners = this.listeners.get(userId) || [];
    const index = userListeners.indexOf(callback);
    if (index > -1) {
      userListeners.splice(index, 1);
      this.listeners.set(userId, userListeners);
    }
  }

  private notifyListeners(userId: string, alert: Alert) {
    const userListeners = this.listeners.get(userId) || [];
    userListeners.forEach(listener => listener(alert));
  }
}

export const notificationService = NotificationService.getInstance();
