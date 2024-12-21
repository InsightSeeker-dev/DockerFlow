import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');
  const isVerifyPage = request.nextUrl.pathname.startsWith('/verify-email');
  const isVerifyRequestPage = request.nextUrl.pathname.startsWith('/verify-request');
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/dashboard/admin');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');

  // Permettre l'accès aux routes API sans redirection
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Rediriger vers la page d'authentification si non connecté
  if (!token && !isAuthPage && !isVerifyPage && !isVerifyRequestPage) {
    const url = new URL('/auth', request.url);
    url.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Rediriger vers le dashboard approprié si déjà connecté et sur la page d'authentification
  if (token && isAuthPage) {
    if (token.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Vérifier si l'email est vérifié pour accéder au dashboard
  if (token && !token.emailVerified && !isVerifyRequestPage && !isVerifyPage) {
    return NextResponse.redirect(new URL('/verify-request', request.url));
  }

  // Protéger les pages admin
  if (isAdminPage) {
    if (!token || token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/auth/:path*',
    '/verify-email/:path*',
    '/verify-request/:path*',
    '/api/admin/:path*'
  ]
};
