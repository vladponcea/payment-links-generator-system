import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signToken, timingSafeCompare } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const appPassword = process.env.APP_PASSWORD;

    if (!appPassword) {
      return NextResponse.json(
        { success: false, error: "Authentication service unavailable" },
        { status: 500 }
      );
    }

    // Timing-safe password comparison
    const isValid = timingSafeCompare(password || "", appPassword);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid password" },
        { status: 401 }
      );
    }

    // Create a signed token
    const payload = btoa(
      JSON.stringify({ authenticated: true, iat: Date.now() })
    );
    const token = await signToken(payload, appPassword);

    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
