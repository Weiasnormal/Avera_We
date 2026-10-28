import { create } from "zustand";

import { notifyProcessingResult } from "@/lib/browser-notifications";
import {
  createCase,
  runAnalysis,
  updateCaseStatus,
  uploadSignature,
} from "@/services/cases";
import type { AnalysisPriority, AnalysisRunResult, CaseSummary, DocumentType } from "@/types/case";

import { useCasesStore } from "./cases";
import { useSessionStore } from "./session";

// New-analysis drafts and the submission pipeline, ported from the mobile
// caseStore (submitNewCase / retryAnalysis). Drafts and their images live in
// memory only; nothing about a case is written to browser storage.

export interface SignatureImage {
  /** PNG produced by lib/image.toPng (already cropped). */
  blob: Blob;
  previewUrl: string;
  sourceName: string;
}

export interface Draft {
  id: string;
  subjectName: string;
  documentType: DocumentType;
  otherDocumentType: string;
  priority: AnalysisPriority;
  references: (SignatureImage | null)[];
  suspect: SignatureImage | null;
  updatedAt: number;
}

export type JobStatus = "submitting" | "success" | "error";

export interface ProcessingJob {
  caseId: string;
  caseCode: string;
  status: JobStatus;
  step: string;
  progress: number;
  error: string | null;
  /** Set when uploads finished, so a retry only re-runs the analysis. */
  uploadsComplete: boolean;
  result: AnalysisRunResult | null;
  startedAt: number;
  /** When the ML request started; drives the stage timeline on the processing screen. */
  analysisStartedAt: number | null;
  finishedAt: number | null;
}

interface AnalysisStore {
  draft: Draft;
  savedDrafts: Draft[];
  jobs: Record<string, ProcessingJob>;
  startNewDraft: () => void;
  openDraft: (id: string) => void;
  discardDraft: () => void;
  saveDraft: () => void;
  updateDraft: (patch: Partial<Pick<Draft, "subjectName" | "documentType" | "otherDocumentType" | "priority">>) => void;
  setImage: (target: "reference" | "suspect", index: number, image: SignatureImage | null) => void;
  submit: (onCaseCreated: (caseId: string) => void) => Promise<void>;
  retry: (caseId: string, caseCode?: string) => Promise<void>;
  reset: () => void;
}

const DEFAULT_DOCUMENT_TYPE: DocumentType = "Bank cheque";
const DEFAULT_PRIORITY: AnalysisPriority = "Medium";

function newDraft(): Draft {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
    subjectName: "",
    documentType: DEFAULT_DOCUMENT_TYPE,
    otherDocumentType: "",
    priority: DEFAULT_PRIORITY,
    references: [null, null, null, null],
    suspect: null,
    updatedAt: Date.now(),
  };
}

export function hasDraftProgress(draft: Draft) {
  return Boolean(
    draft.subjectName.trim() ||
      draft.documentType !== DEFAULT_DOCUMENT_TYPE ||
      draft.priority !== DEFAULT_PRIORITY ||
      draft.references.some(Boolean) ||
      draft.suspect,
  );
}

export function hasCompleteUploads(draft: Draft) {
  return draft.references.every(Boolean) && Boolean(draft.suspect);
}

/** Same rule as mobile step1 canContinue. */
export function hasValidDetails(draft: Draft) {
  return (
    draft.subjectName.trim().length > 1 &&
    (draft.documentType !== "Other" || draft.otherDocumentType.trim().length > 0)
  );
}

function releaseImages(draft: Draft) {
  for (const image of [...draft.references, draft.suspect]) {
    if (image) URL.revokeObjectURL(image.previewUrl);
  }
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => {
  function updateJob(caseId: string, patch: Partial<ProcessingJob>) {
    set((state) => {
      const existing = state.jobs[caseId];
      if (!existing) return state;
      return { jobs: { ...state.jobs, [caseId]: { ...existing, ...patch } } };
    });
  }

  async function analyze(caseId: string) {
    const job = get().jobs[caseId];
    updateJob(caseId, {
      status: "submitting",
      step: "Running AI forensic comparison",
      progress: 70,
      error: null,
      analysisStartedAt: Date.now(),
    });
    const result = await runAnalysis(caseId);
    if (!result.verdict) throw new Error("Analysis did not return a valid verdict.");

    // Same follow-up as mobile: persist the workflow state; failures are non-fatal.
    await updateCaseStatus(caseId, "PendingReview").catch(() => undefined);

    const isSuspected = result.verdict.toUpperCase() === "FORGED";
    useCasesStore.getState().patch(caseId, {
      workflowStatus: "PendingReview",
      status: isSuspected ? "Suspected" : "Genuine",
      verdict: result.verdict,
      confidence: isSuspected ? result.confidenceForged : result.confidenceGenuine,
      resultViewed: false,
    });
    updateJob(caseId, {
      status: "success",
      step: "Complete",
      progress: 100,
      result,
      finishedAt: Date.now(),
    });
    notifyProcessingResult(job?.caseCode ?? caseId, isSuspected ? "suspected" : "genuine");
  }

  return {
    draft: newDraft(),
    savedDrafts: [],
    jobs: {},

    startNewDraft: () =>
      set((state) => ({
        savedDrafts: hasDraftProgress(state.draft)
          ? [...state.savedDrafts.filter((item) => item.id !== state.draft.id), state.draft]
          : state.savedDrafts,
        draft: newDraft(),
      })),

    openDraft: (id) =>
      set((state) => {
        const target = state.savedDrafts.find((item) => item.id === id);
        if (!target) return state;
        const others = state.savedDrafts.filter((item) => item.id !== id);
        return {
          draft: target,
          savedDrafts: hasDraftProgress(state.draft) && state.draft.id !== id ? [...others, state.draft] : others,
        };
      }),

    discardDraft: () =>
      set((state) => {
        releaseImages(state.draft);
        return { draft: newDraft(), savedDrafts: state.savedDrafts.filter((item) => item.id !== state.draft.id) };
      }),

    saveDraft: () =>
      set((state) =>
        hasDraftProgress(state.draft)
          ? {
              savedDrafts: [...state.savedDrafts.filter((item) => item.id !== state.draft.id), state.draft],
              draft: newDraft(),
            }
          : state,
      ),

    updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch, updatedAt: Date.now() } })),

    setImage: (target, index, image) =>
      set((state) => {
        const draft = { ...state.draft, references: [...state.draft.references], updatedAt: Date.now() };
        const previous = target === "reference" ? draft.references[index] : draft.suspect;
        if (previous && previous !== image) URL.revokeObjectURL(previous.previewUrl);
        if (target === "reference") {
          if (index < 0 || index > 3) return state;
          draft.references[index] = image;
        } else {
          draft.suspect = image;
        }
        return { draft };
      }),

    submit: async (onCaseCreated) => {
      const draft = get().draft;
      if (!hasValidDetails(draft)) throw new Error("Subject name is required before submission.");
      if (!hasCompleteUploads(draft)) {
        throw new Error("All reference uploads and the suspect upload must be completed before submission.");
      }

      const { caseId, caseCode } = await createCase({
        subjectName: draft.subjectName.trim(),
        documentType: draft.documentType,
        priority: draft.priority,
      });

      const claims = useSessionStore.getState().claims;
      const placeholder: CaseSummary = {
        caseId,
        caseCode: caseCode ?? caseId,
        subjectName: draft.subjectName.trim(),
        examiner: claims?.email ?? "",
        ownerUserId: claims?.userId,
        tenantId: claims?.tenantId,
        documentType: draft.documentType,
        otherDocumentType: draft.otherDocumentType,
        priority: draft.priority,
        createdAt: new Date().toISOString(),
        status: "Processing",
        workflowStatus: "Processing",
        analysisType: "SIG",
        isFlaggedForInternalReview: false,
        resultViewed: false,
        timeElapsedMs: null,
      };
      useCasesStore.getState().upsert(placeholder);

      set((state) => ({
        jobs: {
          ...state.jobs,
          [caseId]: {
            caseId,
            caseCode: caseCode ?? caseId,
            status: "submitting",
            step: "Uploading reference signatures",
            progress: 10,
            error: null,
            uploadsComplete: false,
            result: null,
            startedAt: Date.now(),
            analysisStartedAt: null,
            finishedAt: null,
          },
        },
        // The draft is now a real case; release it (its images stay referenced by the job below).
        draft: newDraft(),
        savedDrafts: state.savedDrafts.filter((item) => item.id !== draft.id),
      }));
      onCaseCreated(caseId);

      try {
        for (let i = 0; i < draft.references.length; i++) {
          const image = draft.references[i]!;
          updateJob(caseId, { step: `Uploading reference ${i + 1} of 4`, progress: 10 + Math.round((i / 4) * 40) });
          await uploadSignature(caseId, "reference", i + 1, image.blob, `reference-${i + 1}.png`);
        }
        updateJob(caseId, { step: "Uploading suspected signature", progress: 55 });
        await uploadSignature(caseId, "suspected", 1, draft.suspect!.blob, "suspect.png");
        updateJob(caseId, { uploadsComplete: true, progress: 65 });
        releaseImages(draft);

        await analyze(caseId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Something went wrong while submitting the case.";
        updateJob(caseId, { status: "error", error: message, step: message });
        notifyProcessingResult(caseCode ?? caseId, "failed");
        // Keep the images if uploads did not finish so "Start over" can reuse the draft.
        if (!get().jobs[caseId]?.uploadsComplete) {
          set({ draft: { ...draft, id: newDraft().id, updatedAt: Date.now() } });
        }
      }
    },

    retry: async (caseId, caseCode) => {
      if (!get().jobs[caseId]) {
        // Page was reloaded: the uploads are already on the server, only the analysis is re-run.
        set((state) => ({
          jobs: {
            ...state.jobs,
            [caseId]: {
              caseId,
              caseCode: caseCode ?? caseId,
              status: "submitting",
              step: "Re-running AI forensic comparison",
              progress: 65,
              error: null,
              uploadsComplete: true,
              result: null,
              startedAt: Date.now(),
              analysisStartedAt: null,
              finishedAt: null,
            },
          },
        }));
      }
      try {
        await analyze(caseId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to re-run analysis for this case.";
        updateJob(caseId, { status: "error", error: message, step: message });
        throw error;
      }
    },

    reset: () =>
      set((state) => {
        releaseImages(state.draft);
        state.savedDrafts.forEach(releaseImages);
        return { draft: newDraft(), savedDrafts: [], jobs: {} };
      }),
  };
});
