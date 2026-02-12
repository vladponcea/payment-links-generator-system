// Shared auth utilities using Web Crypto API (works in both Edge and Node.js)
import { NextRequest } from "next/server";

const encoder = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Token types ---

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "closer";
  iat: number;
}

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "closer";
}

// --- Token signing / verification ---

export async function signToken(
  payload: string,
  secret: string
): Promise<string> {
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${bufToHex(sig)}`;
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<boolean> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);

  const key = await getKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expected = bufToHex(sig);

  // Constant-time comparison
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// --- Token payload helpers ---

export function createTokenPayload(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "admin" | "closer",
    iat: Date.now(),
  };
  return btoa(JSON.stringify(payload));
}

export function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const lastDot = token.lastIndexOf(".");
    if (lastDot === -1) return null;
    const payloadStr = token.slice(0, lastDot);
    const decoded = JSON.parse(atob(payloadStr));
    if (!decoded.userId || !decoded.role) return null;
    return decoded as TokenPayload;
  } catch {
    return null;
  }
}

// --- Request helpers (for API routes) ---

export function getUserFromRequest(request: NextRequest): AuthUser | null {
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!userId || !role) return null;

  return {
    userId,
    email: request.headers.get("x-user-email") || "",
    name: request.headers.get("x-user-name") || "",
    role: role as "admin" | "closer",
  };
}
