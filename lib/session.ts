import { Session } from 'next-auth';
import { UserRole, UserStatus } from '@prisma/client';

export interface ExtendedSession extends Session {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    cpuLimit: number;
    memoryLimit: number;
  } & Session['user'];
}

export function hasValidStatus(session: ExtendedSession | null): boolean {
  // Log pour le débogage
  console.log('hasValidStatus:', {
    hasSession: !!session,
    userStatus: session?.user?.status
  });

  if (!session?.user) return false;
  return session.user.status === UserStatus.ACTIVE;
}

export function isAdmin(session: ExtendedSession | null): boolean {
  // Log pour le débogage
  console.log('isAdmin:', {
    hasSession: !!session,
    userRole: session?.user?.role
  });

  if (!session?.user) return false;
  return session.user.role === UserRole.ADMIN;
}
