"use client";

import { ArrowLeft, Check, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert } from "@/components/feedback/states";
import { ConfirmDialog, NoticeDialog } from "@/components/modals/confirm-dialog";
import { ImageViewer } from "@/components/modals/image-viewer";
import { useCaseLimit } from "@/components/navigation/new-analysis-button";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/field";
import { PageHeader, Panel } from "@/components/ui/panel";
import { LoadingState } from "@/components/ui/avera-loader";
import { cn } from "@/lib/cn";
import { ImageValidationError, validateImageFile } from "@/lib/image";
import { readPreference, writePreference } from "@/lib/preferences";
import { routes } from "@/lib/routes";
import {
  hasCompleteUploads,
  hasDraftProgress,
  hasValidDetails,
  useAnalysisStore,
} from "@/stores/analysis";
import { toast } from "@/stores/toast";
import { DOCUMENT_TYPES, PRIORITIES, type AnalysisPriority, type DocumentType } from "@/types/case";

import { CropDialog } from "./crop-dialog";
import { CropGuideDialog } from "./crop-guide";
import { UploadSlot } from "./upload-slot";

type Step = 1 | 2;
type SlotTarget = { kind: "reference"; index: number } | { kind: "suspect" };

const CROP_GUIDE_SEEN = "cropGuideSeen";
const CROP_GUIDE_AUTO = "cropGuideAutoShow";

function slotLabel(target: SlotTarget) {
  return target.kind === "suspect" ? "suspected signature" : `SIG ${String(target.index + 1).padStart(2, "0")}`;
}

function Stepper({ step }: { step: Step }) {
  const steps = ["Case details", "Signatures"];
  return (
    <ol className="mb-6 flex items-center gap-3 text-[13px]" aria-label="Progress">
      {steps.map((label, index) => {
        const number = (index + 1) as Step;
        const done = step > number;
        const current = step === number;
        return (
          <li key={label} className="flex items-center gap-3" aria-current={current ? "step" : undefined}>
            {index > 0 ? <span aria-hidden className={cn("h-px w-8 sm:w-14", done || current ? "bg-brand" : "bg-line-strong")} /> : null}
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[12px] font-bold transition-colors duration-200",
                done ? "bg-brand text-white" : current ? "bg-brand-soft text-brand ring-1 ring-brand" : "bg-sunken text-ink-4",
              )}
            >
              {done ? <Check className="size-3.5" /> : number}
            </span>
            <span className={cn("font-semibold", current || done ? "text-ink" : "text-ink-4")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function NewAnalysis() {
  const router = useRouter();
  const draft = useAnalysisStore((state) => state.draft);
  const updateDraft = useAnalysisStore((state) => state.updateDraft);
  const setImage = useAnalysisStore((state) => state.setImage);
  const { reached } = useCaseLimit();

  const [step, setStep] = useState<Step>(1);
  const [touched, setTouched] = useState(false);
  const [cropTarget, setCropTarget] = useState<{ target: SlotTarget; file: File } | null>(null);
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<SlotTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideAgain, setGuideAgain] = useState(true);

  const referencesComplete = draft.references.every(Boolean);
  const detailsValid = hasValidDetails(draft);
  const canSubmit = detailsValid && hasCompleteUploads(draft) && !submitting;

  // Images live only in memory; warn before a reload or tab close discards them.
  useEffect(() => {
    if (!draft.references.some(Boolean) && !draft.suspect) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [draft.references, draft.suspect]);

  const goToUploads = () => {
    setTouched(true);
    if (!detailsValid) return;
    setStep(2);
    const seen = readPreference(CROP_GUIDE_SEEN, false);
    const autoShow = readPreference(CROP_GUIDE_AUTO, true);
    if (!seen || autoShow) {
      setGuideAgain(autoShow);
      setGuideOpen(true);
    }
  };

  const closeGuide = () => {
    setGuideOpen(false);
    writePreference(CROP_GUIDE_SEEN, true);
    writePreference(CROP_GUIDE_AUTO, guideAgain);
  };

  const selectFile = (target: SlotTarget, file: File) => {
    if (target.kind === "suspect" && !referencesComplete) {
      setNotice({
        title: "Complete references first",
        message: "Fill in all four reference signatures before adding the suspected signature.",
      });
      return;
    }
    try {
      validateImageFile(file);
      setCropTarget({ target, file });
    } catch (error) {
      setNotice({
        title: "Image not accepted",
        message: error instanceof ImageValidationError ? error.message : "This file could not be used.",
      });
    }
  };

  const onCropped = (png: Blob) => {
    if (!cropTarget) return;
    const { target, file } = cropTarget;
    const image = { blob: png, previewUrl: URL.createObjectURL(png), sourceName: file.name };
    setImage(target.kind, target.kind === "reference" ? target.index : 0, image);
    setCropTarget(null);
  };

  const removeImage = (target: SlotTarget) => {
    setImage(target.kind, target.kind === "reference" ? target.index : 0, null);
    // The suspect slot depends on all references being present (mobile rule).
    if (target.kind === "reference" && draft.suspect) setImage("suspect", 0, null);
    setPendingRemoval(null);
  };

  const submit = async () => {
    if (!canSubmit) return;
    if (reached) {
      toast.error("Contact your admin. Your case limit has been reached.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await useAnalysisStore.getState().submit((caseId) => router.replace(routes.examiner.processing(caseId)));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong while submitting the case.");
      setSubmitting(false);
    }
  };

  const leave = () => {
    if (hasDraftProgress(draft)) setLeaveOpen(true);
    else router.push(routes.examiner.dashboard);
  };

  // After submit the draft is handed to the processing job; hold a neutral state
  // until the processing page replaces this one.
  if (submitting && !hasCompleteUploads(draft)) {
    return (
      <LoadingState label="Creating case…" className="min-h-[50dvh]" />
    );
  }

  const otherError = touched && draft.documentType === "Other" && !draft.otherDocumentType.trim() ? "Describe the document type" : undefined;
  const subjectError = touched && draft.subjectName.trim().length <= 1 ? "Enter the subject's name (at least 2 characters)" : undefined;

  return (
    <>
      <PageHeader
        back={
          <button type="button" onClick={leave} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
            <ArrowLeft className="size-4" /> Back
          </button>
        }
        title="New analysis"
        description="Compare one questioned signature against four reference samples from the same subject."
      />
      <Stepper step={step} />

      {submitError ? (
        <Alert tone="error" title="Upload issue" className="mb-6">
          {submitError}
        </Alert>
      ) : null}

      {step === 1 ? (
        <Panel title="Case details" description="Basic information for this forensic case" className="max-w-180 animate-fade-in">
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              goToUploads();
            }}
          >
            <TextField
              label="Subject name"
              placeholder="Full name of the signatory"
              value={draft.subjectName}
              onChange={(event) => updateDraft({ subjectName: event.target.value })}
              error={subjectError}
              autoFocus
              maxLength={120}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Document type"
                value={draft.documentType}
                options={DOCUMENT_TYPES}
                onChange={(event) => {
                  const documentType = event.target.value as DocumentType;
                  updateDraft({ documentType, ...(documentType !== "Other" ? { otherDocumentType: "" } : {}) });
                }}
              />
              {draft.documentType === "Other" ? (
                <TextField
                  label="Document type details"
                  placeholder="e.g. Promissory note"
                  value={draft.otherDocumentType}
                  onChange={(event) => updateDraft({ otherDocumentType: event.target.value })}
                  error={otherError}
                  maxLength={80}
                />
              ) : null}
            </div>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold text-ink">Priority</legend>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((priority: AnalysisPriority) => {
                  const selected = draft.priority === priority;
                  const urgent = priority === "Urgent";
                  return (
                    <label
                      key={priority}
                      className={cn(
                        "pressable flex h-9 cursor-pointer items-center rounded-full border px-4 text-[13px] font-semibold has-focus-visible:outline-2 has-focus-visible:outline-brand",
                        selected
                          ? urgent
                            ? "border-danger bg-danger-soft text-danger"
                            : "border-brand bg-brand-soft text-brand-strong"
                          : "border-line-strong bg-surface text-ink-2 hover:border-ink-4",
                      )}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={priority}
                        checked={selected}
                        onChange={() => updateDraft({ priority })}
                        className="sr-only"
                      />
                      {priority}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="flex items-start gap-2 text-[12.5px] text-ink-3">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              The case code is assigned by Avera when you run the analysis.
            </p>
            <div className="flex justify-end border-t border-line pt-5">
              <Button type="submit">Continue</Button>
            </div>
          </form>
        </Panel>
      ) : (
        <div className="flex flex-col gap-6 animate-fade-in">
          <Panel
            title="Reference signatures"
            description="Add 4 known-genuine samples of the subject's signature"
            actions={
              <Button size="sm" variant="ghost" icon={<Info className="size-4" />} onClick={() => setGuideOpen(true)}>
                Cropping tips
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {draft.references.map((image, index) => {
                const target: SlotTarget = { kind: "reference", index };
                return (
                  <UploadSlot
                    key={index}
                    label={`SIG ${String(index + 1).padStart(2, "0")}`}
                    caption="Reference"
                    image={image}
                    disabled={submitting}
                    onSelect={(file) => selectFile(target, file)}
                    onRemove={() => setPendingRemoval(target)}
                    onPreview={() => image && setPreview({ src: image.previewUrl, title: `Reference SIG ${String(index + 1).padStart(2, "0")}` })}
                  />
                );
              })}
            </div>
          </Panel>

          <Panel title="Suspected signature" description="Add the 1 questioned sample to verify">
            <div className="max-w-160">
              <UploadSlot
                label="QUESTIONED"
                caption="Suspected"
                variant="suspect"
                image={draft.suspect}
                disabled={submitting}
                locked={!referencesComplete}
                lockedMessage="Add all four references first"
                onSelect={(file) => selectFile({ kind: "suspect" }, file)}
                onRemove={() => setPendingRemoval({ kind: "suspect" })}
                onPreview={() => draft.suspect && setPreview({ src: draft.suspect.previewUrl, title: "Suspected signature" })}
              />
            </div>
          </Panel>

          <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:flex-row sm:items-center sm:px-6 lg:-mx-8 lg:px-8">
            <Button variant="secondary" onClick={() => setStep(1)} disabled={submitting}>
              Back to details
            </Button>
            <p className="text-[12.5px] text-ink-3 sm:mr-auto sm:ml-3 tabular">
              {draft.references.filter(Boolean).length + (draft.suspect ? 1 : 0)} of 5 images added · PNG, JPEG or WebP, up to 15 MB
            </p>
            <Button size="lg" onClick={() => void submit()} disabled={!canSubmit} loading={submitting}>
              {submitting ? "Creating case…" : "Run analysis"}
            </Button>
          </div>
        </div>
      )}

      <CropDialog
        file={cropTarget?.file ?? null}
        label={cropTarget ? slotLabel(cropTarget.target) : ""}
        onCancel={() => setCropTarget(null)}
        onComplete={onCropped}
      />
      <CropGuideDialog open={guideOpen} showAgain={guideAgain} onShowAgainChange={setGuideAgain} onClose={closeGuide} />
      <ImageViewer src={preview?.src ?? null} title={preview?.title ?? ""} onClose={() => setPreview(null)} />
      <NoticeDialog
        open={notice !== null}
        onClose={() => setNotice(null)}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        tone="error"
      />
      <ConfirmDialog
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) removeImage(pendingRemoval);
        }}
        tone="danger"
        title={`Remove ${pendingRemoval ? slotLabel(pendingRemoval) : "image"}?`}
        description={
          pendingRemoval?.kind === "reference" && draft.suspect
            ? "The suspected signature will also be cleared, since it requires all four references."
            : "You can add a different image afterwards."
        }
        confirmLabel="Remove"
      />
      <SaveDraftDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} />
    </>
  );
}

/** Mobile draft_saved modal: keep the draft for later, discard it, or stay. */
function SaveDraftDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const exit = (action: "saveDraft" | "discardDraft") => {
    useAnalysisStore.getState()[action]();
    onClose();
    router.push(routes.examiner.dashboard);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Save this draft?"
      description="Saved drafts stay on your dashboard until you close or reload this tab. Images are not stored anywhere else."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="sm:mr-auto">
            Keep editing
          </Button>
          <Button variant="danger-ghost" onClick={() => exit("discardDraft")}>
            Discard
          </Button>
          <Button onClick={() => exit("saveDraft")}>Save draft</Button>
        </>
      }
    />
  );
}
