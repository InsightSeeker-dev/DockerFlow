import { getSession } from 'next-auth/react';

/**
 * Redirige côté client selon le rôle de l'utilisateur.
 * Si admin => /admin, sinon /dashboard
 */
export async function redirectAfterLogin(router: any) {
  const session = await getSession();
  if (session?.user?.role === 'ADMIN') {
    router.push('/admin');
  } else {
    router.push('/dashboard');
  }
}
