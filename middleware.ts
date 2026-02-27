import { NextRequest, NextResponse } from "next/server";
import { verifyToken, decodeTokenPayload } from "@/lib/auth";

const TOKEN_SECRET = process.env.APP_PASSWORD || "fallback-never-use-this";

// Routes that closers are NOT allowed to access
const ADMIN_ONLY_ROUTES = ["/closers", "/settings"];
const ADMIN_ONLY_API_PREFIXES = [
  "/api/closers",
  "/api/users",
  "/api/webhooks/register",
  "/api/webhooks/status",
  "/api/webhooks/zapier-retry",
  "/api/settings/zapier",
];

const DEMO_MODE = process.env.DEMO_MODE === "true";

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

  // Demo mode: skip auth, inject user based on demo_user cookie
  if (DEMO_MODE) {
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const DEMO_USERS: Record<string, { id: string; role: string; email: string; name: string }> = {
      admin: { id: "user_admin_1", role: "admin", email: "demo@closerpay.com", name: "Demo Admin" },
      closer_1: { id: "user_closer_1", role: "closer", email: "alex@closerpay.com", name: "Alex Rivera" },
      closer_2: { id: "user_closer_2", role: "closer", email: "jordan@closerpay.com", name: "Jordan Chen" },
    };

    const demoUserKey = request.cookies.get("demo_user")?.value || "admin";
    const demoUser = DEMO_USERS[demoUserKey] || DEMO_USERS.admin;

    // Apply closer role restrictions in demo mode too
    if (demoUser.role === "closer") {
      if (ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      if (ADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.json(
          { success: false, error: "Admin access required" },
          { status: 403 }
        );
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", demoUser.id);
    requestHeaders.set("x-user-role", demoUser.role);
    requestHeaders.set("x-user-email", demoUser.email);
    requestHeaders.set("x-user-name", demoUser.name);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
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
