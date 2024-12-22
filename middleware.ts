import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { UserStatus } from '@prisma/client';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // Définir les chemins protégés et publics
  const isPublicPath = pathname.startsWith('/auth') || 
                      pathname.startsWith('/verify-email') || 
                      pathname.startsWith('/verify-request') ||
                      pathname.startsWith('/verify-success') ||
                      pathname.startsWith('/verify-error');
  const isApiPath = pathname.startsWith('/api');
  const isAdminPath = pathname.startsWith('/admin');

  // Permettre l'accès aux routes API sans redirection
  if (isApiPath) {
    return NextResponse.next();
  }

  // Si l'utilisateur n'est pas connecté et essaie d'accéder à une route protégée
  if (!token && !isPublicPath) {
    const url = new URL('/auth', request.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Si l'utilisateur est connecté mais son email n'est pas vérifié
  if (token && !token.emailVerified && !isPublicPath) {
    return NextResponse.redirect(new URL('/verify-request', request.url));
  }

  // Si l'utilisateur est connecté et essaie d'accéder à une page publique
  if (token?.emailVerified && pathname === '/auth') {
    const redirectUrl = token.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // Protéger les pages admin
  if (isAdminPath && token?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/admin/:path*',
    '/auth/:path*',
    '/verify-email/:path*',
    '/verify-request/:path*',
    '/verify-success/:path*',
    '/verify-error/:path*',
    '/api/admin/:path*'
  ]
};
