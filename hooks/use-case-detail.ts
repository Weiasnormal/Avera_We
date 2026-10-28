"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchCaseDetail } from "@/services/cases";
import { onHubEvent, payloadCaseId } from "@/services/realtime";
import { useSessionStore } from "@/stores/session";
import type { CaseDetail } from "@/types/case";

/** GET /cases/{id}, refreshed when the hub reports a review or flag on this case. */
export function useCaseDetail(caseId: string) {
  const tenantId = useSessionStore((state) => state.claims?.tenantId);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchCaseDetail(caseId, tenantId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this case.");
    } finally {
      setLoading(false);
    }
  }, [caseId, tenantId]);

  useEffect(() => {
    // Data fetching on mount; state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const matches = (payload: Record<string, unknown> | undefined) =>
      payloadCaseId(payload)?.toLowerCase() === caseId.toLowerCase();
    const offReview = onHubEvent("CaseReviewCompleted", (payload) => matches(payload) && void load());
    const offFlag = onHubEvent("CaseFlagged", (payload) => matches(payload) && void load());
    const offReconnect = onHubEvent("reconnected", () => void load());
    return () => {
      offReview();
      offFlag();
      offReconnect();
    };
  }, [caseId, load]);

  return { detail, setDetail, error, loading, reload: load };
}
