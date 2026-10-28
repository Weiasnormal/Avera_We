// Runtime-agnostic JWT claim reading (works in proxy.ts and route handlers).
// The token is never verified here — the backend is the authority. These claims
// only drive routing and UI; every request is still authorized by the API.

export interface SessionClaims {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  role: "user" | "admin";
  expiresAt: string | null;
}

type RawClaims = Record<string, unknown>;

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwtPayload(token: string): RawClaims | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload && typeof payload === "object" ? (payload as RawClaims) : null;
  } catch {
    return null;
  }
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

// Mirrors the claim lookup in the mobile app's authStore.decodeToken.
export function claimsFromToken(token: string): SessionClaims | null {
  const decoded = decodeJwtPayload(token);
  if (!decoded) return null;

  const rawRole =
    decoded.role ??
    decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"] ??
    decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
  const roles = (Array.isArray(rawRole) ? rawRole : rawRole ? [rawRole] : []).map(String);
  const exp = typeof decoded.exp === "number" ? decoded.exp : null;

  return {
    userId: firstString(
      decoded.nameid,
      decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"],
      decoded.sub,
    ),
    tenantId: firstString(
      decoded.TenantId,
      decoded.tenantId,
      decoded.groupsid,
      decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid"],
    ),
    email: firstString(
      decoded.email,
      decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
    ),
    roles,
    role: roles.some((r) => r.toLowerCase().includes("admin")) ? "admin" : "user",
    expiresAt: exp ? new Date(exp * 1000).toISOString() : null,
  };
}

export function isExpired(claims: SessionClaims | null): boolean {
  if (!claims?.expiresAt) return true;
  return new Date(claims.expiresAt).getTime() <= Date.now();
}

// Same rule as SignInPage.hasSupportedRole in the mobile app.
export function hasSupportedRole(roles: string[]): boolean {
  return roles.some((role) => {
    const value = role.toLowerCase();
    return value.includes("admin") || value.includes("user") || value.includes("analyst");
  });
}
