import { create } from "zustand";

import { fetchCasesPage, markCaseViewed } from "@/services/cases";
import type { CaseSummary } from "@/types/case";

// Case list shared by dashboards, case tables and statistics. The backend list
// is tenant/role scoped; examiners receive their own cases, admins the org's.

const PAGE_SIZE = 50;

interface CasesStore {
  cases: CaseSummary[];
  totalCount: number;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  loadedAt: number | null;
  /** Loads every page (mobile: refreshCasesFromBackend + loadAllCases). */
  load: () => Promise<void>;
  markViewed: (caseId: string) => void;
  upsert: (item: CaseSummary) => void;
  patch: (caseId: string, patch: Partial<CaseSummary>) => void;
  reset: () => void;
}

let inflight: Promise<void> | null = null;

export const useCasesStore = create<CasesStore>((set, get) => ({
  cases: [],
  totalCount: 0,
  status: "idle",
  error: null,
  loadedAt: null,

  load: () => {
    if (inflight) return inflight;
    set((state) => ({ status: state.loadedAt ? state.status : "loading", error: null }));
    inflight = (async () => {
      try {
        const first = await fetchCasesPage(1, PAGE_SIZE);
        const all = [...first.cases];
        let page = 1;
        while (all.length < first.totalCount && page < 200) {
          page += 1;
          const next = await fetchCasesPage(page, PAGE_SIZE);
          if (next.cases.length === 0) break;
          const seen = new Set(all.map((item) => item.caseId));
          all.push(...next.cases.filter((item) => !seen.has(item.caseId)));
        }
        // Keep optimistic "viewed" flags for cases the user opened during this session.
        const previous = new Map(get().cases.map((item) => [item.caseId, item]));
        const merged = all.map((item) =>
          previous.get(item.caseId)?.resultViewed && item.workflowStatus !== "Processing"
            ? { ...item, resultViewed: true }
            : item,
        );
        set({ cases: merged, totalCount: first.totalCount, status: "ready", error: null, loadedAt: Date.now() });
      } catch (error) {
        set({ status: "error", error: error instanceof Error ? error.message : "Unable to load cases." });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  markViewed: (caseId) => {
    const item = get().cases.find((entry) => entry.caseId === caseId);
    if (item?.resultViewed) return;
    get().patch(caseId, { resultViewed: true });
    void markCaseViewed(caseId).catch(() => undefined);
  },

  upsert: (item) =>
    set((state) => {
      const exists = state.cases.some((entry) => entry.caseId === item.caseId);
      return {
        cases: exists
          ? state.cases.map((entry) => (entry.caseId === item.caseId ? { ...entry, ...item } : entry))
          : [item, ...state.cases],
        totalCount: exists ? state.totalCount : state.totalCount + 1,
      };
    }),

  patch: (caseId, patch) =>
    set((state) => ({
      cases: state.cases.map((entry) => (entry.caseId === caseId ? { ...entry, ...patch } : entry)),
    })),

  reset: () => set({ cases: [], totalCount: 0, status: "idle", error: null, loadedAt: null }),
}));

export function sortByNewest(cases: CaseSummary[]) {
  return [...cases].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function isCreatedToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
  );
}

/** Search across the same fields as the mobile utils/caseSearch.ts. */
export function caseMatchesSearch(item: CaseSummary, query: string, role: "admin" | "user") {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const date = new Date(item.createdAt);
  const values = [
    item.caseId,
    item.caseCode,
    item.subjectName,
    item.examiner,
    item.documentType,
    item.otherDocumentType,
    item.priority,
    item.createdAt,
    Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(),
    item.status === "Genuine" ? "genuine" : item.status === "Suspected" ? "suspected" : "",
    item.verdict,
    role === "admin"
      ? item.workflowStatus === "PendingReview"
        ? "pending"
        : ""
      : item.workflowStatus === "Processing"
        ? "processing"
        : "",
  ];
  return values.some((value) => typeof value === "string" && value.toLowerCase().includes(normalized));
}
