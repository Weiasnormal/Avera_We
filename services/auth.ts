import type { SessionClaims } from "@/lib/jwt";
import { NETWORK_ERROR_MESSAGE } from "./api/client";
import { ApiError, apiJson, apiRequest, backendUrl, getServerErrorMessage, readJson } from "./api/client";
import { API_ENDPOINTS } from "./api/endpoints";

// Auth calls ported from the mobile app (services/authApi.ts and
// services/emailVerificationApi.ts). Token-issuing responses are captured by the
// proxy into the httpOnly cookie; the browser only receives decoded claims.

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  organization: string;
  dailyCaseLimit: number | null;
  avatarUri: string | null;
}

export async function login(email: string, password: string): Promise<SessionClaims> {
  const json = await apiJson<{ session?: SessionClaims | null }>(API_ENDPOINTS.auth.login, {
    method: "POST",
    body: { email, password },
    skipUnauthorizedHandling: true,
  });
  if (!json?.session) throw new Error("Sign-in response did not include a valid session.");
  return json.session;
}

export async function fetchSession(): Promise<SessionClaims | null> {
  try {
    const response = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return null;
    const json = (await response.json()) as { session: SessionClaims | null };
    return json.session;
  } catch {
    return null;
  }
}

export async function clearLocalSession(): Promise<void> {
  await fetch("/api/session", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
}

/** POST /auth/logout, best effort; the proxy clears the cookie either way. */
export async function logout(): Promise<void> {
  try {
    await apiRequest(API_ENDPOINTS.auth.logout, { method: "POST", skipUnauthorizedHandling: true });
  } catch {
    // The token may already be invalid — the local session is cleared below.
  }
  await clearLocalSession();
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "User" | "Admin";
}

export async function register(input: RegisterInput): Promise<void> {
  await apiRequest(API_ENDPOINTS.auth.register, { method: "POST", body: input, skipUnauthorizedHandling: true });
}

// --- Registration resume (mobile authApi.resumeUnverifiedRegistration) -------

function isRegistrationConflict(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  const knownConflict = (error.status === 400 || error.status === 409) && /already|taken|exists|registered/i.test(error.message);
  const postCreateFailure =
    error.status >= 500 && /already|taken|exists|registered|email|verification|created/i.test(error.message);
  return knownConflict || postCreateFailure;
}

/**
 * When registering an address that already exists but was never verified, the
 * mobile app resends the verification email and continues to the verify screen.
 */
export async function resumeUnverifiedRegistration(input: RegisterInput, registrationError: unknown): Promise<boolean> {
  const canResume =
    isRegistrationConflict(registrationError) ||
    (registrationError instanceof Error &&
      /already|taken|exists|registered|email|verification|created/i.test(registrationError.message));
  if (!canResume) return false;
  const result = await resendVerificationEmail(input.email);
  return result.ok;
}

export function isEmailVerificationRequired(error: unknown) {
  return (
    error instanceof ApiError &&
    [400, 401, 403].includes(error.status) &&
    /email.*(verify|verified|confirm|confirmed|activation)|(verify|verified|confirm|confirmed|activation).*email/i.test(
      error.message,
    )
  );
}

export function normalizeAuthErrorMessage(message: unknown, email?: string): string {
  const trimmed = String(message ?? "").trim();
  if (!trimmed) return NETWORK_ERROR_MESSAGE;
  const emailLabel = email?.trim() ? ` (${email.trim()})` : "";
  if (/(username|user name|email)/i.test(trimmed) && /(already|taken|exists|registered)/i.test(trimmed)) {
    return `Email${emailLabel} is already taken`;
  }
  return trimmed;
}

export function normalizeInviteCodeErrorMessage(message: unknown): string {
  const text = String(message ?? "").trim();
  if (!text) return "Unable to verify invite code. Please try again.";
  if (/(expired|expiration)/i.test(text)) return "This invite code has expired. Please request a new one.";
  if (/(invalid|not valid|not recognized|does not exist|wrong code|incorrect code|bad code)/i.test(text)) {
    return "Invite code is invalid. Please check the code and try again.";
  }
  if (/(already used|used up|already been used)/i.test(text)) return "This invite code has already been used.";
  if (/(already.*(pending|request|member|organization|tenant)|pending.*request|request.*already)/i.test(text)) {
    return "You already have a pending request for this organization.";
  }
  if (/(full|capacity|member.*(limit|maximum)|no seats|seat.*left)/i.test(text)) {
    return "This organization has reached its member limit.";
  }
  if (/(organization.*(not found|missing)|tenant.*(not found|missing))/i.test(text)) {
    return "The organization tied to this invite code could not be found.";
  }
  return "Unable to verify invite code. Please try again.";
}

/** POST /auth/join-invite-code. Returns the refreshed session when the backend issues one. */
export async function joinInviteCode(inviteCode: string): Promise<SessionClaims | null> {
  const code = inviteCode.trim().toUpperCase();
  const json = await apiJson<{ session?: SessionClaims | null }>(API_ENDPOINTS.auth.joinInviteCode, {
    method: "POST",
    body: { inviteCode: code, code },
  });
  return json?.session ?? null;
}

// --- Profile -----------------------------------------------------------------

export async function fetchCurrentUser(): Promise<UserProfile> {
  const json = (await apiJson<Record<string, unknown>>(API_ENDPOINTS.auth.profile)) ?? {};
  const limit = json.dailyCaseLimit;
  return {
    firstName: String(json.firstName ?? ""),
    lastName: String(json.lastName ?? ""),
    email: String(json.email ?? ""),
    role: String(json.role ?? ""),
    organization: String(json.organization ?? ""),
    dailyCaseLimit: typeof limit === "number" && Number.isFinite(limit) && limit >= 0 ? limit : null,
    avatarUri: typeof json.avatarUri === "string" && json.avatarUri ? json.avatarUri : null,
  };
}

export const profilePictureUrl = (version = 0) => `${backendUrl(API_ENDPOINTS.auth.profilePicture)}?v=${version}`;

export async function uploadProfilePicture(file: Blob, fileName: string): Promise<void> {
  const body = new FormData();
  body.append("file", file, fileName);
  await apiRequest(API_ENDPOINTS.auth.profilePicture, { method: "POST", body });
}

export async function changeName(firstName: string, lastName: string): Promise<void> {
  await apiRequest(API_ENDPOINTS.auth.changeName, {
    method: "POST",
    body: { NewName: firstName, NewLastName: lastName },
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest(API_ENDPOINTS.auth.changePassword, {
    method: "POST",
    body: { currentPassword, newPassword },
    skipUnauthorizedHandling: true,
  });
}

export async function deleteAccount(): Promise<void> {
  await apiRequest(API_ENDPOINTS.auth.deleteAccount, { method: "DELETE" });
  await clearLocalSession();
}

// --- Password recovery -------------------------------------------------------

export async function forgotPassword(email: string): Promise<{ implemented: boolean; expiresAt?: string }> {
  try {
    const response = await apiRequest(API_ENDPOINTS.auth.forgotPassword, {
      method: "POST",
      body: { email },
      skipUnauthorizedHandling: true,
    });
    const headerExpiry = response.headers.get("x-code-expires-at") ?? undefined;
    const retryAfter = Number(response.headers.get("retry-after"));
    const body = (await readJson<Record<string, unknown>>(response).catch(() => null)) ?? {};
    const bodyExpiry = body.expiresAt ?? body.ExpiresAt ?? body.codeExpiresAt ?? body.CodeExpiresAt ?? body.expiration;
    const expiresIn = Number(body.expiresInSeconds ?? body.ExpiresInSeconds ?? body.expiresIn);
    const expiresAt =
      typeof bodyExpiry === "string"
        ? bodyExpiry
        : Number.isFinite(expiresIn) && expiresIn > 0
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : (headerExpiry ??
            (Number.isFinite(retryAfter) && retryAfter > 0 ? new Date(Date.now() + retryAfter * 1000).toISOString() : undefined));
    return { implemented: true, expiresAt };
  } catch {
    return { implemented: false };
  }
}

export async function verifyResetCode(email: string, code: string): Promise<boolean> {
  try {
    await apiRequest(API_ENDPOINTS.auth.verifyResetCode, {
      method: "POST",
      body: { email, code },
      skipUnauthorizedHandling: true,
    });
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 0) throw error;
    return false;
  }
}

export async function resetPassword(email: string, token: string, password: string): Promise<void> {
  await apiRequest(API_ENDPOINTS.auth.resetPassword, {
    method: "POST",
    body: { email, token, password },
    skipUnauthorizedHandling: true,
  });
}

// --- Email verification ------------------------------------------------------

export interface RequestResult {
  ok: boolean;
  message?: string;
}

async function toResult(call: () => Promise<unknown>): Promise<RequestResult> {
  try {
    await call();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : getServerErrorMessage(0) };
  }
}

export function resendVerificationEmail(email: string): Promise<RequestResult> {
  return toResult(() =>
    apiRequest(API_ENDPOINTS.auth.resendVerificationEmail, {
      method: "POST",
      body: { email: email.trim().toLowerCase() },
      skipUnauthorizedHandling: true,
    }),
  );
}

export function resendEmailChangeVerification(currentEmail: string, newEmail: string): Promise<RequestResult> {
  return toResult(() =>
    apiRequest(API_ENDPOINTS.auth.resendVerificationEmail, {
      method: "POST",
      body: {
        email: currentEmail.trim().toLowerCase(),
        type: "change-email",
        newEmail: newEmail.trim().toLowerCase(),
      },
    }),
  );
}

/** GET /auth/verify-email?userId&token[&type&email&newEmail] — the link from the verification email. */
export async function verifyEmailToken(
  userId: string,
  token: string,
  options?: { type?: string; email?: string; newEmail?: string },
): Promise<boolean> {
  const query = new URLSearchParams({ userId, token });
  if (options?.type) query.set("type", options.type);
  if (options?.email) query.set("email", options.email);
  if (options?.newEmail) query.set("newEmail", options.newEmail);
  try {
    await apiRequest(`${API_ENDPOINTS.auth.verifyEmail}?${query}`, { skipUnauthorizedHandling: true });
    return true;
  } catch {
    return false;
  }
}

export async function requestEmailChange(newEmail: string, currentPassword: string): Promise<RequestResult> {
  try {
    await apiRequest(API_ENDPOINTS.auth.changeEmail, {
      method: "POST",
      body: { newEmail, currentPassword },
      skipUnauthorizedHandling: true,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { ok: false, message: "Your session has expired. Sign in again, then retry changing your email." };
    }
    return { ok: false, message: error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE };
  }
}
