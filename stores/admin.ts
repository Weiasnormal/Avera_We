import { create } from "zustand";

import * as adminApi from "@/services/admin";
import type { TeamMember, TenantProfile } from "@/services/admin";

import { useSessionStore } from "./session";
import { toast } from "./toast";

// Team and organization state for Org Admins (mobile store/adminStore.ts).
// Mutations are optimistic and roll back on failure, as on mobile.

interface AdminStore {
  members: TeamMember[];
  pending: TeamMember[];
  teamStatus: "idle" | "loading" | "ready" | "error";
  teamError: string | null;
  tenant: TenantProfile | null;
  tenantStatus: "idle" | "loading" | "ready" | "error";
  loadTeam: () => Promise<void>;
  loadTenant: () => Promise<void>;
  approve: (requestId: string) => Promise<void>;
  reject: (requestId: string) => Promise<void>;
  setSuspended: (userId: string, suspended: boolean) => Promise<boolean>;
  remove: (userId: string) => Promise<boolean>;
  setMemberLimit: (limit: number) => Promise<boolean>;
  rename: (name: string) => Promise<boolean>;
  reset: () => void;
}

function tenantId() {
  return useSessionStore.getState().claims?.tenantId ?? "";
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  members: [],
  pending: [],
  teamStatus: "idle",
  teamError: null,
  tenant: null,
  tenantStatus: "idle",

  loadTeam: async () => {
    set((state) => ({ teamStatus: state.teamStatus === "ready" ? "ready" : "loading", teamError: null }));
    try {
      const { members, pending } = await adminApi.fetchTeam(tenantId());
      set({ members, pending, teamStatus: "ready" });
    } catch (error) {
      set({ teamStatus: "error", teamError: error instanceof Error ? error.message : "Unable to load team members" });
    }
  },

  loadTenant: async () => {
    set((state) => ({ tenantStatus: state.tenant ? "ready" : "loading" }));
    try {
      set({ tenant: await adminApi.fetchTenantProfile(), tenantStatus: "ready" });
    } catch {
      set((state) => ({ tenantStatus: state.tenant ? "ready" : "error" }));
    }
  },

  approve: async (requestId) => {
    const before = get().pending;
    const request = before.find((item) => item.id === requestId);
    if (!request) {
      toast.info("Member request is outside your organization");
      return;
    }
    set({ pending: before.filter((item) => item.id !== requestId) });
    try {
      await adminApi.approveMemberRequest(requestId);
      toast.success("Member request approved");
      void get().loadTeam();
      void get().loadTenant();
    } catch (error) {
      set({ pending: before });
      toast.error(error instanceof Error && error.message ? error.message : "Unable to approve member request. Try again.");
    }
  },

  reject: async (requestId) => {
    const before = get().pending;
    if (!before.some((item) => item.id === requestId)) {
      toast.info("Member request is outside your organization");
      return;
    }
    set({ pending: before.filter((item) => item.id !== requestId) });
    try {
      await adminApi.rejectMemberRequest(requestId);
      toast.success("Member request declined");
    } catch {
      set({ pending: before });
      toast.error("Unable to decline member request. Try again.");
    }
  },

  setSuspended: async (userId, suspended) => {
    const before = get().members;
    set({
      members: before.map((member) =>
        member.id === userId ? { ...member, status: suspended ? "suspended" : "active" } : member,
      ),
    });
    try {
      if (suspended) await adminApi.suspendMember(userId);
      else await adminApi.unsuspendMember(userId);
      toast.success(suspended ? "Member suspended" : "Member unsuspended");
      return true;
    } catch {
      set({ members: before });
      toast.error(suspended ? "Unable to suspend member. Try again." : "Unable to unsuspend member. Try again.");
      return false;
    }
  },

  remove: async (userId) => {
    const claims = useSessionStore.getState().claims;
    const target = get().members.find((member) => member.id === userId);
    if (claims?.userId === userId || adminApi.isProtectedMemberRole(target?.role)) {
      toast.info("Admins cannot be removed");
      return false;
    }
    const before = get().members;
    set({ members: before.filter((member) => member.id !== userId) });
    try {
      await adminApi.removeMember(userId);
      toast.success("Member removed from the organization");
      void get().loadTenant();
      return true;
    } catch (error) {
      set({ members: before });
      toast.error(error instanceof Error && error.message ? error.message : "Unable to remove member. Try again.");
      return false;
    }
  },

  setMemberLimit: async (limit) => {
    try {
      const normalized = await adminApi.setMemberCountLimit(limit);
      set((state) => ({ tenant: state.tenant ? { ...state.tenant, memberCountLimit: normalized } : state.tenant }));
      toast.success(`Member limit set to ${normalized}`);
      return true;
    } catch {
      toast.error("Unable to update member limit. Try again.");
      return false;
    }
  },

  rename: async (name) => {
    if (!name.trim()) return false;
    try {
      await adminApi.renameTenant(name);
      await get().loadTenant();
      useSessionStore.getState().patchProfile({ organization: name.trim() });
      toast.success("Organization renamed");
      return true;
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Unable to rename organization. Try again.");
      return false;
    }
  },

  reset: () => set({ members: [], pending: [], teamStatus: "idle", teamError: null, tenant: null, tenantStatus: "idle" }),
}));
