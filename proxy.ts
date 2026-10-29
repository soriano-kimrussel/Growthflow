import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for signed-out visitors. The real check (session lookup,
 * sub-account and role resolution) happens on the server in lib/auth/context.ts
 * for every page and action; this only saves a round trip.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("gf_session")) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/contacts/:path*",
    "/opportunities/:path*",
    "/calendar/:path*",
    "/tasks/:path*",
    "/campaigns/:path*",
    "/workflows/:path*",
    "/outbox/:path*",
    "/settings/:path*",
    "/agency/:path*",
  ],
};
