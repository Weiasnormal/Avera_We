import { NextResponse } from "next/server";

import { clearSessionCookie, readSession } from "@/lib/server/session";

// Returns the decoded claims of the current session (never the token itself).
export async function GET() {
  const session = await readSession();
  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
}

// Local sign-out: drops the cookie without calling the backend. Used after an
// expired/unauthorized response, where POST /auth/logout cannot succeed anyway.
export async function DELETE() {
  const response = NextResponse.json({ session: null });
  clearSessionCookie(response);
  return response;
}
