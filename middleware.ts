import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const TOKEN_SECRET = process.env.APP_PASSWORD || "fallback-never-use-this";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, webhook endpoint, and auth API
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/webhooks/whop"
  ) {
    return NextResponse.next();
  }

  // Check for valid auth token
  const authToken = request.cookies.get("auth_token")?.value;
  const isAuthenticated = authToken
    ? await verifyToken(authToken, TOKEN_SECRET)
    : false;

  // Login page: redirect to dashboard if already authenticated
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // All other routes: require authentication
  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
