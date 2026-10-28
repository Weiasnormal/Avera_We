"use client";

import { useEffect, useState } from "react";

import { fetchCasesPage } from "@/services/cases";
import type { CaseSummary } from "@/types/case";

const PAGE_SIZE = 25;

export function useCasesPage(page: number) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchCasesPage(page, PAGE_SIZE)
      .then((result) => {
        if (!active) return;
        setCases(result.cases);
        setTotalCount(result.totalCount);
        setError(null);
        setLoadedPage(page);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Unable to load cases.");
      });
    return () => {
      active = false;
    };
  }, [page]);

  return {
    cases,
    totalCount,
    pageSize: PAGE_SIZE,
    error,
    reload: () => {
      setLoadedPage(null);
      return fetchCasesPage(page, PAGE_SIZE)
        .then((result) => {
          setCases(result.cases);
          setTotalCount(result.totalCount);
          setError(null);
          setLoadedPage(page);
        })
        .catch((reason) => {
          setError(reason instanceof Error ? reason.message : "Unable to load cases.");
        });
    },
    isLoading: loadedPage !== page,
  };
}
