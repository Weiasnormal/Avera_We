import { FinalVerdict, type CaseDetail } from "@/types/case";

// Verdict resolution shared by the examiner result and the admin review,
// matching signature_results.tsx / CaseResultAdmin.tsx. Nothing is computed
// beyond selecting which backend value to show.

export type VerdictLabel = "GENUINE" | "SUSPECTED";

export interface ResolvedVerdict {
  /** ML service verdict, or null when the case has no ML response. */
  model: VerdictLabel | null;
  /** Confidence the model reported for its own verdict. */
  modelConfidence: number | null;
  /** Reviewer's final verdict, when a review has been saved. */
  reviewed: VerdictLabel | null;
  /** What the case currently stands at: the review, otherwise the model. */
  displayed: VerdictLabel | null;
  isReviewed: boolean;
  isOverride: boolean;
}

export function resolveVerdict(detail: CaseDetail): ResolvedVerdict {
  const raw = detail.mlResponse?.verdict?.toUpperCase();
  const model: VerdictLabel | null = raw === "FORGED" ? "SUSPECTED" : raw === "GENUINE" ? "GENUINE" : null;
  const modelConfidence = detail.mlResponse
    ? model === "SUSPECTED"
      ? detail.mlResponse.confidenceForged
      : model === "GENUINE"
        ? detail.mlResponse.confidenceGenuine
        : null
    : null;
  const reviewed: VerdictLabel | null =
    detail.finalVerdict === FinalVerdict.Forged ? "SUSPECTED" : detail.finalVerdict === FinalVerdict.Genuine ? "GENUINE" : null;
  return {
    model,
    modelConfidence,
    reviewed,
    displayed: reviewed ?? model,
    isReviewed: reviewed !== null,
    isOverride: reviewed !== null && model !== null && reviewed !== model,
  };
}

export function titleCase(label: VerdictLabel | null) {
  return label === "SUSPECTED" ? "Suspected" : label === "GENUINE" ? "Genuine" : "Pending";
}
