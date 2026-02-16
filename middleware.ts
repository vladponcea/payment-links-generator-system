import { NextRequest, NextResponse } from "next/server";
import { verifyToken, decodeTokenPayload } from "@/lib/auth";

const TOKEN_SECRET = process.env.APP_PASSWORD || "fallback-never-use-this";

// Routes that closers are NOT allowed to access
const ADMIN_ONLY_ROUTES = ["/closers", "/down-payments", "/settings"];
const ADMIN_ONLY_API_PREFIXES = [
  "/api/closers",
  "/api/down-payments",
  "/api/users",
  "/api/webhooks/register",
  "/api/webhooks/status",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, webhook endpoint, auth API, and setup
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/webhooks/whop"
  ) {
    return NextResponse.next();
  }

  // Check for valid auth token AND valid payload format
  const authToken = request.cookies.get("auth_token")?.value;
  let isAuthenticated = false;
  let payload = authToken ? decodeTokenPayload(authToken) : null;

  if (authToken && payload) {
    // Token has the right payload shape — now verify the HMAC signature
    isAuthenticated = await verifyToken(authToken, TOKEN_SECRET);
    if (!isAuthenticated) {
      payload = null;
    }
  }

  // If there's a cookie but it's stale/invalid, clear it to prevent redirect loops
  if (authToken && !isAuthenticated) {
    const clearResponse =
      pathname === "/login"
        ? NextResponse.next()
        : pathname.startsWith("/api/")
        ? NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url));

    clearResponse.cookies.set("auth_token", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return clearResponse;
  }

  // Login page: redirect to dashboard if already authenticated
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // All other routes: require authentication
  if (!isAuthenticated || !payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Role-based access control for closers
  if (payload.role === "closer") {
    // Block admin-only pages
    if (ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Block admin-only API routes
    if (ADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }
  }

  // Set user info headers for API routes and server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-name", payload.name);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
