import { create } from "zustand";

import type { SessionClaims } from "@/lib/jwt";
import * as authApi from "@/services/auth";
import type { UserProfile } from "@/services/auth";

interface SessionStore {
  claims: SessionClaims | null;
  profile: UserProfile | null;
  profileError: string | null;
  /** Bumped after an avatar upload so <img> refetches the picture. */
  avatarVersion: number;
  setClaims: (claims: SessionClaims | null) => void;
  loadProfile: () => Promise<void>;
  patchProfile: (patch: Partial<UserProfile>) => void;
  bumpAvatar: () => void;
  signOut: () => Promise<void>;
  /** Clears client state after the server-side session ended (401, deleted account). */
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  claims: null,
  profile: null,
  profileError: null,
  avatarVersion: Date.now(),

  setClaims: (claims) => {
    const previous = get().claims;
    if (previous?.userId !== claims?.userId) set({ profile: null });
    set({ claims });
  },

  loadProfile: async () => {
    const userId = get().claims?.userId;
    try {
      const profile = await authApi.fetchCurrentUser();
      if (get().claims?.userId !== userId) return; // signed out or switched meanwhile
      set({ profile, profileError: null });
    } catch (error) {
      // Keep the last usable profile when a refresh fails (mobile UserProvider behavior).
      set({ profileError: error instanceof Error ? error.message : "Unable to load your profile." });
    }
  },

  patchProfile: (patch) => {
    const profile = get().profile;
    if (profile) set({ profile: { ...profile, ...patch } });
  },

  bumpAvatar: () => set({ avatarVersion: Date.now() }),

  signOut: async () => {
    await authApi.logout();
    get().reset();
  },

  reset: () => set({ claims: null, profile: null, profileError: null }),
}));

export function displayName(profile: UserProfile | null, fallback = "") {
  const name = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim();
  return name || fallback;
}
