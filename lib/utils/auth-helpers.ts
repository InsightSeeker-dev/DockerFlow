import { Session } from 'next-auth';

export const ROLE_ADMIN = 'ADMIN';
export const ROLE_USER = 'USER';
export const STATUS_ACTIVE = 'ACTIVE';
export const STATUS_INACTIVE = 'INACTIVE';
export const STATUS_SUSPENDED = 'SUSPENDED';

export type UserRole = typeof ROLE_ADMIN | typeof ROLE_USER;
export type UserStatus = typeof STATUS_ACTIVE | typeof STATUS_INACTIVE | typeof STATUS_SUSPENDED;

export function isAdmin(session: Session | null): session is Session {
  return Boolean(session?.user?.role === ROLE_ADMIN);
}

export function isAuthenticated(session: Session | null): session is Session & { user: { id: string } } {
  return Boolean(session?.user?.id);
}

export function hasValidStatus(session: Session | null): session is Session {
  return Boolean(session?.user?.status === STATUS_ACTIVE);
}

export function isAdminAndActive(session: Session | null): session is Session {
  return isAdmin(session) && hasValidStatus(session);
}
