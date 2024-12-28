import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};