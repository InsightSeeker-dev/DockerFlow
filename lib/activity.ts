import { prisma } from '@/lib/prisma';
import { ActivityType } from '@prisma/client';
import { headers } from 'next/headers';

interface ActivityData {
  type: ActivityType;
  description: string;
  userId: string;
  metadata?: any;
}

// Fonction générique pour enregistrer une activité
export async function logActivity(data: ActivityData) {
  try {
    const headersList = headers();
    const userAgent = headersList.get('user-agent');
    const ip = headersList.get('x-forwarded-for') || 
               headersList.get('x-real-ip') || 
               'unknown';

    await prisma.activity.create({
      data: {
        type: data.type,
        description: data.description,
        userId: data.userId,
        metadata: data.metadata || {},
        ipAddress: ip,
        userAgent: userAgent || undefined,
      },
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Fonctions spécifiques pour les conteneurs
export const containerActivity = {
  async create(userId: string, containerName: string, metadata?: any) {
    await logActivity({
      type: ActivityType.CONTAINER_CREATE,
      description: `Created container: ${containerName}`,
      userId,
      metadata,
    });
  },

  async start(userId: string, containerName: string, metadata?: any) {
    await logActivity({
      type: ActivityType.CONTAINER_START,
      description: `Started container: ${containerName}`,
      userId,
      metadata,
    });
  },

  async stop(userId: string, containerName: string, metadata?: any) {
    await logActivity({
      type: ActivityType.CONTAINER_STOP,
      description: `Stopped container: ${containerName}`,
      userId,
      metadata,
    });
  },

  async delete(userId: string, containerName: string, metadata?: any) {
    await logActivity({
      type: ActivityType.CONTAINER_DELETE,
      description: `Deleted container: ${containerName}`,
      userId,
      metadata,
    });
  },
};

// Fonctions spécifiques pour les images Docker
export const imageActivity = {
  async pull(userId: string, imageName: string, metadata?: any) {
    await logActivity({
      type: ActivityType.IMAGE_PULL,
      description: `Pulled image: ${imageName}`,
      userId,
      metadata,
    });
  },

  async delete(userId: string, imageName: string, metadata?: any) {
    await logActivity({
      type: ActivityType.IMAGE_DELETE,
      description: `Deleted image: ${imageName}`,
      userId,
      metadata,
    });
  },
};

// Fonctions spécifiques pour les alertes
export const alertActivity = {
  async triggered(userId: string, alertTitle: string, metadata?: any) {
    await logActivity({
      type: ActivityType.ALERT_TRIGGERED,
      description: `Alert triggered: ${alertTitle}`,
      userId,
      metadata,
    });
  },

  async resolved(userId: string, alertTitle: string, metadata?: any) {
    await logActivity({
      type: ActivityType.ALERT_RESOLVED,
      description: `Alert resolved: ${alertTitle}`,
      userId,
      metadata,
    });
  },
};

// Fonctions spécifiques pour les utilisateurs
export const userActivity = {
  async update(userId: string, details: string, metadata?: any) {
    await logActivity({
      type: ActivityType.USER_UPDATE,
      description: `Profile updated: ${details}`,
      userId,
      metadata,
    });
  },

  async delete(userId: string, username: string, metadata?: any) {
    await logActivity({
      type: ActivityType.USER_DELETE,
      description: `User deleted: ${username}`,
      userId,
      metadata,
    });
  },
};

// Fonctions spécifiques pour le système
export const systemActivity = {
  async update(userId: string, details: string, metadata?: any) {
    await logActivity({
      type: ActivityType.SYSTEM_UPDATE,
      description: `System update: ${details}`,
      userId,
      metadata,
    });
  },
};
