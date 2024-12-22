import { Session } from 'next-auth';
import { UserRole, UserStatus } from '@prisma/client';

export function hasValidStatus(session: Session | null): boolean {
  // Log pour le débogage
  console.log('hasValidStatus:', {
    hasSession: !!session,
    userStatus: session?.user?.status
  });

  if (!session?.user) return false;
  return session.user.status === UserStatus.ACTIVE;
}

export function isAdmin(session: Session | null): boolean {
  // Log pour le débogage
  console.log('isAdmin:', {
    hasSession: !!session,
    userRole: session?.user?.role
  });

  if (!session?.user) return false;
  return session.user.role === UserRole.ADMIN;
}
