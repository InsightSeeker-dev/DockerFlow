import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Autoriser les WebSockets pour le terminal
  if (
    request.nextUrl.pathname.startsWith('/api/terminal') &&
    request.headers.get('upgrade')?.toLowerCase() === 'websocket'
  ) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request });
  const path = request.nextUrl.pathname;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/reset-password'];
  const isPublicRoute = publicRoutes.includes(path);

  if (!token && !isPublicRoute) {
    // Not signed in and trying to access protected route
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isPublicRoute) {
    // Signed in and trying to access auth page
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};