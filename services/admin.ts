import type { SessionClaims } from "@/lib/jwt";
import { normalizeInviteCode, normalizePersonName } from "@/lib/format";

import { apiJson, apiRequest } from "./api/client";
import { ADMIN_API_ENDPOINTS } from "./api/endpoints";

// Tenant / organization administration, ported from the mobile adminStore.

export type TeamMemberRole = "Analyst" | "Org Admin";
export type TeamMemberStatus = "active" | "pending" | "suspended";

export interface TeamMember {
  /** User id for members; member-request id for pending entries (approve/reject use the request id). */
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  casesHandled: number;
  requestedAt: string | null;
}

export interface TenantMemberDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isSuspended: boolean;
  dailyCaseLimit: number | null;
}

export interface TenantProfile {
  name: string;
  inviteCode: string;
  memberCount: number;
  memberCountLimit: number;
  createdAt: string;
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function recordTenantId(record: Raw): string | null {
  const value = record?.tenantId ?? record?.TenantId ?? record?.organizationId ?? record?.OrganizationId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Same guard as the mobile belongsToCurrentTenant. */
function belongsToTenant(record: Raw, tenantId: string): boolean {
  const recordTenant = recordTenantId(record);
  return Boolean(tenantId) && (!recordTenant || recordTenant === tenantId);
}

function normalizeRole(role: unknown): TeamMemberRole {
  const value = String(role ?? "").trim().toLowerCase();
  return value.includes("admin") || value.includes("owner") ? "Org Admin" : "Analyst";
}

export function isProtectedMemberRole(role: string | undefined) {
  const value = role?.trim().toLowerCase() ?? "";
  return value.includes("owner") || value.includes("admin");
}

/** Loads active analysts and pending member requests (GET /tenant/members + pending requests). */
export async function fetchTeam(tenantId: string): Promise<{ members: TeamMember[]; pending: TeamMember[] }> {
  const [membersJson, pendingJson] = await Promise.all([
    apiJson<Raw[]>(ADMIN_API_ENDPOINTS.team.list),
    apiJson<Raw[]>(ADMIN_API_ENDPOINTS.memberRequests.pending).catch(() => []),
  ]);

  const members: TeamMember[] = (Array.isArray(membersJson) ? membersJson : [])
    .filter((member) => belongsToTenant(member, tenantId))
    .map((member) => ({
      id: String(member.id ?? member.Id ?? ""),
      firstName: normalizePersonName(member.firstName || "Unknown"),
      lastName: normalizePersonName(member.lastName || ""),
      email: member.email || "—",
      role: normalizeRole(member.role ?? member.Role ?? member.roles ?? member.Roles),
      status: (member.isSuspended ?? member.IsSuspended) ? ("suspended" as const) : ("active" as const),
      casesHandled: Number(member.casesHandled ?? member.CasesHandled ?? 0),
      requestedAt: null,
    }))
    .filter((member) => member.id && member.role === "Analyst");

  const pending: TeamMember[] = (Array.isArray(pendingJson) ? pendingJson : [])
    .filter((request) => belongsToTenant(request, tenantId))
    .map((request) => {
      const [firstName, ...rest] = String(request.name ?? "").trim().split(/\s+/);
      return {
        id: String(request.requestId ?? request.RequestId ?? ""),
        firstName: normalizePersonName(firstName || "Unknown"),
        lastName: normalizePersonName(rest.join(" ")),
        email: "—",
        role: "Analyst" as const,
        status: "pending" as const,
        casesHandled: 0,
        requestedAt: request.requestedAt ?? request.RequestedAt ?? null,
      };
    })
    .filter((request) => request.id);

  return { members, pending };
}

export async function approveMemberRequest(requestId: string) {
  await apiRequest(ADMIN_API_ENDPOINTS.memberRequests.approve(requestId), { method: "POST" });
}

export async function rejectMemberRequest(requestId: string) {
  await apiRequest(ADMIN_API_ENDPOINTS.memberRequests.reject(requestId), { method: "POST" });
}

export async function fetchMember(userId: string, tenantId: string): Promise<TenantMemberDetail> {
  const json = await apiJson<Raw>(ADMIN_API_ENDPOINTS.team.getById(userId));
  if (!json || !belongsToTenant(json, tenantId)) throw new Error("This member is not part of your organization.");
  const id = String(json.id ?? "").trim();
  if (!id) throw new Error("Backend returned malformed member data");
  const rawLimit = json.dailyCaseLimit ?? json.DailyCaseLimit ?? json.dailyLimit ?? json.DailyLimit ?? null;
  const limit = rawLimit === null || rawLimit === undefined ? null : Number(rawLimit);
  return {
    id,
    firstName: normalizePersonName(json.firstName?.trim() || ""),
    lastName: normalizePersonName(json.lastName?.trim() || ""),
    email: json.email?.trim() || "",
    role: json.role?.trim() || "Analyst",
    isSuspended: Boolean(json.isSuspended ?? json.IsSuspended),
    dailyCaseLimit: limit !== null && Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : null,
  };
}

/** POST /admin/suspend-user?UserId=… */
export async function suspendMember(userId: string) {
  await apiRequest(`${ADMIN_API_ENDPOINTS.tenant.suspendUser}?UserId=${encodeURIComponent(userId)}`, { method: "POST" });
}

/** POST /admin/unsuspend-user with the user id as a JSON string body. */
export async function unsuspendMember(userId: string) {
  await apiRequest(ADMIN_API_ENDPOINTS.tenant.unsuspendUser, { method: "POST", body: JSON.stringify(userId) });
}

export async function removeMember(userId: string) {
  await apiRequest(ADMIN_API_ENDPOINTS.team.remove(userId), { method: "DELETE" });
}

export async function setDailyCaseLimit(userId: string, dailyLimit: number | null) {
  const normalized = dailyLimit === null ? null : Math.max(0, Math.trunc(dailyLimit));
  await apiRequest(ADMIN_API_ENDPOINTS.tenant.setDailyLimit, {
    method: "POST",
    body: { UserId: userId, DailyLimit: normalized },
  });
  return normalized;
}

/** POST /admin/set-member-count-limit with the number as the JSON body. */
export async function setMemberCountLimit(limit: number) {
  const normalized = Math.max(0, Math.trunc(limit));
  await apiRequest(ADMIN_API_ENDPOINTS.tenant.setMemberCountLimit, { method: "POST", body: JSON.stringify(normalized) });
  return normalized;
}

export async function fetchTenantProfile(): Promise<TenantProfile> {
  const json = (await apiJson<Raw>(ADMIN_API_ENDPOINTS.tenant.profile)) ?? {};
  return {
    name: json.name ?? json.Name ?? "",
    inviteCode: json.inviteCode ?? json.InviteCode ?? "",
    memberCount: Number(json.memberCount ?? json.MemberCount ?? 0),
    memberCountLimit: Number(json.memberCountLimit ?? json.MemberCountLimit ?? 0),
    createdAt: json.createdAt ?? json.CreatedAt ?? "",
  };
}

export async function fetchInviteCode(): Promise<string> {
  const value = await apiJson<unknown>(ADMIN_API_ENDPOINTS.tenant.inviteCode);
  const object = typeof value === "object" && value !== null ? (value as Raw) : null;
  const raw = typeof value === "string" ? value : (object?.inviteCode ?? object?.InviteCode ?? object?.code ?? object?.Code);
  const code = typeof raw === "string" ? normalizeInviteCode(raw) : null;
  if (!code) throw new Error("Backend returned no invite code");
  return code;
}

export async function renameTenant(newName: string) {
  await apiRequest(ADMIN_API_ENDPOINTS.tenant.rename, { method: "POST", body: { newName: newName.trim() } });
}

/** POST /tenants — the response carries a new token with the TenantId claim (stored by the proxy). */
export async function createTenant(name: string): Promise<SessionClaims | null> {
  const json = await apiJson<{ session?: SessionClaims | null }>(ADMIN_API_ENDPOINTS.tenant.create, {
    method: "POST",
    body: { Name: name },
  });
  return json?.session ?? null;
}
