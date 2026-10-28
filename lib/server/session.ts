import "server-only";

import { cookies } from "next/headers";
import { connection, type NextResponse } from "next/server";

import { claimsFromToken, isExpired, type SessionClaims } from "@/lib/jwt";
import { SESSION_COOKIE } from "./config";

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function readSession(): Promise<SessionClaims | null> {
  // The expiry check reads the clock, so this must run at request time.
  await connection();
  const token = await readSessionToken();
  if (!token) return null;
  const claims = claimsFromToken(token);
  return claims && !isExpired(claims) ? claims : null;
}

export function writeSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt?: string | null,
) {
  const claims = claimsFromToken(token);
  const expiry = expiresAt ?? claims?.expiresAt ?? null;
  const maxAge = expiry
    ? Math.max(0, Math.floor((new Date(expiry).getTime() - Date.now()) / 1000))
    : undefined;

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return claims ? { ...claims, expiresAt: expiry } : null;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// Blocks cross-site use of the cookie-authenticated proxy (the backend runs
// side effects on some GET endpoints, e.g. GET /cases/{id}/analysis).
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}
