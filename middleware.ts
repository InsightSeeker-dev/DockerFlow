import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { UserRole, UserStatus } from '@prisma/client';

// Routes qui ne nécessitent pas d'authentification
const PUBLIC_PATHS = ['/auth'];
const PUBLIC_API_PATHS = ['/api/auth'];
const PROTECTED_API_PATHS = ['/api/admin', '/api/containers', '/api/users', '/api/volumes'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Bloquer directement les accès à verify-request
  if (pathname === '/verify-request') {
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  
  // Gestion des routes API
  if (pathname.startsWith('/api')) {
    // Routes API publiques (auth)
    if (PUBLIC_API_PATHS.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // Routes API protégées
    if (PROTECTED_API_PATHS.some(path => pathname.startsWith(path))) {
      const token = await getToken({ req: request });
      if (!token || token.status !== UserStatus.ACTIVE) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Protection spéciale des routes admin
      if (pathname.startsWith('/api/admin') && token.role !== UserRole.ADMIN) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return NextResponse.next();
  }

  const token = await getToken({ req: request });
  const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path));

  // Log pour le débogage
  console.log('Middleware:', {
    pathname,
    hasToken: !!token,
    tokenRole: token?.role,
    tokenStatus: token?.status,
    isPublicPath
  });

  // Cas 1: Utilisateur non authentifié
  if (!token) {
    // Autoriser l'accès aux routes publiques
    if (isPublicPath) {
      return NextResponse.next();
    }
    // Rediriger vers la page de connexion
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // Cas 2: Vérification du statut utilisateur
  if (token.status !== UserStatus.ACTIVE) {
    // Déconnexion si le statut n'est pas actif
    return NextResponse.redirect(new URL('/auth?error=AccountInactive', request.url));
  }

  // Cas 3: Utilisateur authentifié sur une page publique
  if (isPublicPath) {
    const destination = token.role === UserRole.ADMIN ? '/admin/dashboard' : '/dashboard';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Cas 4: Accès à la racine
  if (pathname === '/') {
    const destination = token.role === UserRole.ADMIN ? '/admin/dashboard' : '/dashboard';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Cas 5: Protection des routes admin
  if (pathname.startsWith('/admin')) {
    if (token.role !== UserRole.ADMIN) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // Si c'est un admin, autoriser l'accès
    return NextResponse.next();
  }

  // Autoriser l'accès à toutes les autres routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/verify-request',
    '/dashboard/:path*',
    '/admin/:path*',
    '/auth/:path*',
    '/api/admin/:path*',
    '/api/containers/:path*',
    '/api/users/:path*'
  ]
};
