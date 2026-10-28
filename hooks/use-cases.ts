"use client";

import { useEffect } from "react";

import { useCasesStore } from "@/stores/cases";

/** Loads the case list on mount (and again when a page is revisited). */
export function useCases() {
  const cases = useCasesStore((state) => state.cases);
  const status = useCasesStore((state) => state.status);
  const error = useCasesStore((state) => state.error);
  const load = useCasesStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  return { cases, status, error, reload: load, isInitialLoading: status === "loading" || status === "idle" };
}
