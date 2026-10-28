// Domain types carried over from the mobile app (store/caseStore.ts,
// services/caseReviewApi.ts, services/signatureAnalysis.ts).

export type AnalysisPriority = "Low" | "Medium" | "High" | "Urgent";
export type AnalysisType = "SIG" | "HW" | "DOC";
export type DocumentType = "Bank cheque" | "Property deed" | "Last will" | "Contract" | "Affidavit" | "Other";

/** Verdict-level status shown on lists: the ML verdict, or the admin's final verdict when set. */
export type CaseStatus = "Processing" | "Genuine" | "Suspected";
/** Workflow state from Avera.Domain/Cases/Status.cs. */
export type CaseWorkflowStatus = "Processing" | "PendingReview" | "Reviewed";

export const DOCUMENT_TYPES: DocumentType[] = ["Bank cheque", "Property deed", "Last will", "Contract", "Affidavit", "Other"];
export const PRIORITIES: AnalysisPriority[] = ["Low", "Medium", "High", "Urgent"];

/** Request values for POST /cases (DocumentType / Priority enums). */
export const DOCUMENT_TYPE_VALUE: Record<DocumentType, number> = {
  "Bank cheque": 0,
  "Property deed": 1,
  "Last will": 2,
  Contract: 3,
  Affidavit: 4,
  Other: 5,
};
export const PRIORITY_VALUE: Record<AnalysisPriority, number> = { Low: 0, Medium: 1, High: 2, Urgent: 3 };

export interface CaseSummary {
  caseId: string;
  caseCode: string;
  subjectName: string;
  examiner: string;
  ownerUserId?: string;
  tenantId?: string;
  documentType: DocumentType;
  otherDocumentType: string;
  priority: AnalysisPriority;
  createdAt: string;
  status: CaseStatus;
  workflowStatus: CaseWorkflowStatus;
  analysisType: AnalysisType;
  verdict?: string;
  confidence?: number;
  isFlaggedForInternalReview: boolean;
  resultViewed?: boolean;
  timeElapsedMs: number | null;
}

/** Mirrors Avera.Domain/Cases/FinalVerdict.cs — values match the backend. */
export enum FinalVerdict {
  None = 0,
  Genuine = 1,
  Forged = 2,
}

export type OverlaySlot = "Reference1" | "Reference2" | "Reference3" | "Reference4" | "Suspected";
export type OverlayVariant = "Original" | "Heatmap" | "Overlay" | "BoundingBox" | "StrokeDiff";
export const REFERENCE_SLOTS: OverlaySlot[] = ["Reference1", "Reference2", "Reference3", "Reference4"];

export interface GradCamImage {
  imageId: string;
  slot: OverlaySlot;
  variant: OverlayVariant;
}

/** Mirrors Avera.Application/Cases/MLResponseDto.cs */
export interface MLResponse {
  confidenceForged: number;
  confidenceGenuine: number;
  distance: number;
  threshold: number;
  /** Raw ML verdict string, e.g. "GENUINE" | "FORGED". */
  verdict: string;
  gradCamResults: GradCamImage[];
}

/** Mirrors Avera.Application/Cases/CaseDto.cs (GET /cases/{id}). */
export interface CaseDetail {
  id: string;
  caseCode: string;
  subjectName: string;
  ownerUserId: string | null;
  examiner: string;
  priority: AnalysisPriority;
  createdAt: string;
  caseStatus: CaseWorkflowStatus;
  documentType: DocumentType;
  otherDocumentType: string;
  isDeleted: boolean;
  mlResponse: MLResponse | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  finalVerdict: FinalVerdict | null;
  isPdfExportAllowed: boolean;
  isFlaggedForInternalReview: boolean;
  timeElapsedMs: number | null;
}

/** Result of GET /cases/{id}/analysis (the ProcessResponse). */
export interface AnalysisRunResult {
  caseName: string;
  verdict: string | null;
  confidenceForged: number;
  confidenceGenuine: number;
  distance: number;
  threshold: number;
  overlayImages: GradCamImage[];
}

export type ResultViewMode = "Heatmap" | "Bounding Box" | "Stroke Diff";
export const RESULT_VIEW_MODES: ResultViewMode[] = ["Heatmap", "Bounding Box", "Stroke Diff"];
export const VIEW_MODE_TO_VARIANT: Record<ResultViewMode, OverlayVariant> = {
  Heatmap: "Heatmap",
  "Bounding Box": "BoundingBox",
  "Stroke Diff": "StrokeDiff",
};
