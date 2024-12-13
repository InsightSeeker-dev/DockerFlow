import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');
  const isVerifyPage = request.nextUrl.pathname.startsWith('/verify-email');
  const isVerifyRequestPage = request.nextUrl.pathname.startsWith('/verify-request');

  // Rediriger vers la page d'authentification si non connecté
  if (!token && !isAuthPage && !isVerifyPage && !isVerifyRequestPage) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // Rediriger vers le dashboard si déjà connecté et sur la page d'authentification
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Vérifier si l'email est vérifié pour accéder au dashboard
  if (token && !token.emailVerified && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/verify-request', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/auth',
    '/verify-email',
    '/verify-request'
  ]
};
