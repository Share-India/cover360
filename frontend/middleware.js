import { NextResponse } from 'next/server';

export function middleware(request) {
  // Check if there is any token in the cookies or header.
  // Note: Since this is an enterprise app, JWT should ideally be in HTTP-only cookies.
  // For now, if we are using localStorage on the client, the middleware can't read it easily.
  // A simple check is to just let the client side handle the redirect if it's purely SPA,
  // or use cookies. Assuming we transition to cookies for JWT in the backend.
  
  // This is a placeholder middleware that protects /dashboard 
  // if you implement cookie-based auth.
  const token = request.cookies.get('jwt_token');

  // If we are strictly using localStorage, client-side protection in layout.js is needed.
  // But for enterprise, let's assume we'll set a cookie.
  
  if (request.nextUrl.pathname.startsWith('/dashboard') && !token) {
    // If no token, redirect to login
    // return NextResponse.redirect(new URL('/login', request.url));
    // NOTE: Commented out the strict redirect so as not to break the app if they 
    // are still using localStorage exclusively. 
    // In a full enterprise setup, this will be uncommented once backend sets cookies.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
