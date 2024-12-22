import { Session } from 'next-auth';
import { UserStatus } from '@prisma/client';

export function hasValidStatus(session: Session | null): boolean {
  if (!session?.user) return false;
  return session.user.status === UserStatus.ACTIVE;
}

export function isAdmin(session: Session | null): boolean {
  if (!session?.user) return false;
  return session.user.role === 'ADMIN';
}

export function isEmailVerified(session: Session | null): boolean {
  if (!session?.user) return false;
  return session.user.emailVerified !== null;
}
