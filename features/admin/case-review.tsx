"use client";

import { AlertCircle, CircleCheck, FileDown, Flag, Info } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, EmptyState, LoadError } from "@/components/feedback/states";
import { ConfirmDialog } from "@/components/modals/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Panel } from "@/components/ui/panel";
import { CaseDetailSkeleton, CaseHeader } from "@/features/results/case-header";
import { EvidenceViewer } from "@/features/results/evidence-viewer";
import { ReportActions } from "@/features/results/report-actions";
import { resolveVerdict, titleCase, type VerdictLabel } from "@/features/results/verdict";
import { CaseFacts, ReviewStatus, VerdictSummary } from "@/features/results/verdict-summary";
import { useCaseDetail } from "@/hooks/use-case-detail";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import { routes } from "@/lib/routes";
import { ApiError } from "@/services/api/client";
import { setInternalReviewFlag, submitCaseReview } from "@/services/cases";
import { useCasesStore } from "@/stores/cases";
import { toast } from "@/stores/toast";
import { FinalVerdict } from "@/types/case";

const NOTE_LIMIT = 500;

/** Org Admin review of a case (mobile CaseResultAdmin.tsx). Reviews are one-shot on the backend. */
export function CaseReview({ caseId }: { caseId: string }) {
  const { detail, setDetail, error, loading, reload } = useCaseDetail(caseId);
  const [decision, setDecision] = useState<VerdictLabel | null>(null);
  const [pdfAllowed, setPdfAllowed] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flagBusy, setFlagBusy] = useState(false);

  useEffect(() => {
    if (!detail) return;
    const reviewed = detail.finalVerdict === FinalVerdict.Genuine ? "GENUINE" : detail.finalVerdict === FinalVerdict.Forged ? "SUSPECTED" : null;
    // Seed the form from the loaded case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDecision(reviewed);
    setNote(detail.reviewNote ?? "");
    // Before a review, PDF export defaults to on (mobile DEFAULT_PDF_EXPORT_ALLOWED).
    setPdfAllowed(reviewed ? detail.isPdfExportAllowed : true);
  }, [detail]);

  if (loading && !detail) return <CaseDetailSkeleton />;
  if (error && !detail) return <LoadError message={error} onRetry={() => void reload()} />;
  if (!detail) return <CaseDetailSkeleton />;

  const verdict = resolveVerdict(detail);
  const alreadyReviewed = verdict.isReviewed;
  const isOverride = decision !== null && verdict.model !== null && decision !== verdict.model;

  const save = async () => {
    if (!decision || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await submitCaseReview(caseId, {
        finalVerdict: decision === "GENUINE" ? FinalVerdict.Genuine : FinalVerdict.Forged,
        reviewNote: note.trim() ? note.trim() : null,
        isPdfExportAllowed: pdfAllowed,
      });
      toast.success("Review saved");
      setConfirmOpen(false);
      useCasesStore.getState().patch(caseId, {
        workflowStatus: "Reviewed",
        status: decision === "GENUINE" ? "Genuine" : "Suspected",
      });
      await reload();
    } catch (saveFailure) {
      setConfirmOpen(false);
      if (saveFailure instanceof ApiError && saveFailure.status === 409) {
        setSaveError("This case has already been reviewed. Refresh to see the latest status.");
      } else if (saveFailure instanceof ApiError && saveFailure.status === 403) {
        setSaveError("Only Org Admins can submit a supervisor review.");
      } else {
        setSaveError(saveFailure instanceof Error ? saveFailure.message : "Unable to save this review.");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleFlag = async (value: boolean) => {
    setFlagBusy(true);
    try {
      await setInternalReviewFlag(caseId, value);
      setDetail({ ...detail, isFlaggedForInternalReview: value });
      useCasesStore.getState().patch(caseId, { isFlaggedForInternalReview: value });
      toast.success(value ? "Case flagged for internal review" : "Internal review flag removed");
    } catch (flagError) {
      toast.error(flagError instanceof Error ? flagError.message : "Unable to update the internal review flag.");
    } finally {
      setFlagBusy(false);
    }
  };

  return (
    <>
      <CaseHeader
        detail={detail}
        backHref={routes.admin.cases}
        backLabel="Cases"
        actions={
          <ReportActions
            caseId={caseId}
            caseCode={detail.caseCode}
            allowed={alreadyReviewed ? detail.isPdfExportAllowed : true}
            disabledReason="PDF export is not enabled for this case. Save the review with PDF export enabled first."
          />
        }
      />

      {!detail.mlResponse ? (
        <Panel>
          <EmptyState title="No analysis results yet" description="This case has not produced a model result. It can be reviewed once the analysis completes." />
        </Panel>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-5">
            <VerdictSummary detail={detail} verdict={verdict} />
            <Panel>
              <CaseFacts detail={detail} showExaminer />
            </Panel>
            <EvidenceViewer caseId={caseId} overlays={detail.mlResponse.gradCamResults} />
          </div>

          <aside className="flex flex-col gap-4 xl:sticky xl:top-24">
            <Panel title="Supervisor review" bodyClassName="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-md bg-canvas px-3.5 py-2.5 text-[13px]">
                <span className="text-ink-3">Model assessment</span>
                <span className={cn("font-semibold tabular", verdict.model === "SUSPECTED" ? "text-suspect" : "text-genuine")}>
                  {formatPercent(verdict.modelConfidence)} {titleCase(verdict.model)}
                </span>
              </div>

              {saveError ? <Alert tone="error">{saveError}</Alert> : null}

              {alreadyReviewed ? (
                <ReviewStatus detail={detail} verdict={verdict} />
              ) : (
                <>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-[13px] font-semibold text-ink">Final verdict</legend>
                    {(["SUSPECTED", "GENUINE"] as const).map((option) => {
                      const selected = decision === option;
                      const agreesWithModel = option === verdict.model;
                      const Icon = option === "SUSPECTED" ? AlertCircle : CircleCheck;
                      return (
                        <label
                          key={option}
                          className={cn(
                            "pressable flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand",
                            selected
                              ? option === "SUSPECTED"
                                ? "border-suspect bg-suspect-soft"
                                : "border-genuine bg-genuine-soft"
                              : "border-line-strong hover:border-ink-4",
                          )}
                        >
                          <input type="radio" name="decision" className="sr-only" checked={selected} onChange={() => setDecision(option)} />
                          <Icon className={cn("mt-0.5 size-4 shrink-0", option === "SUSPECTED" ? "text-suspect" : "text-genuine")} aria-hidden />
                          <span>
                            <span className="block text-[14px] font-semibold text-ink">Confirm {titleCase(option)}</span>
                            <span className="block text-[12.5px] text-ink-3">
                              {agreesWithModel ? "Agrees with the model verdict" : "Overrides the model verdict"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>

                  <label className="flex flex-col gap-1.5">
                    <span className="flex items-baseline justify-between text-[13px] font-semibold text-ink">
                      <span>
                        Review note <span className="font-normal text-ink-4">(optional)</span>
                      </span>
                      <span className={cn("text-[12px] font-normal tabular", note.length > NOTE_LIMIT ? "text-danger" : "text-ink-4")}>
                        {note.length}/{NOTE_LIMIT}
                      </span>
                    </span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value.slice(0, NOTE_LIMIT))}
                      placeholder="Add observations, evidence references, or rationale for this review decision…"
                      className="min-h-28 resize-y rounded-md border border-line-strong px-3 py-2.5 text-[13.5px] leading-relaxed outline-none placeholder:text-ink-4 focus:border-brand focus:shadow-[0_0_0_3px_rgb(30_111_217/0.14)]"
                    />
                  </label>
                </>
              )}

              <div className="divide-y divide-line border-t border-line">
                <Switch
                  icon={<FileDown className="size-4" />}
                  label="Enable PDF export"
                  description={alreadyReviewed ? "Set when the review was saved." : "Lets the examiner export the report."}
                  checked={pdfAllowed}
                  onChange={setPdfAllowed}
                  disabled={alreadyReviewed}
                />
                <Switch
                  icon={<Flag className="size-4" />}
                  label="Flag for internal review"
                  description="Marks the case for follow-up. Saved immediately."
                  checked={detail.isFlaggedForInternalReview}
                  onChange={(value) => void toggleFlag(value)}
                  disabled={flagBusy}
                />
              </div>

              {!alreadyReviewed ? (
                <>
                  <p className="flex items-start gap-2 text-[12.5px] text-ink-3">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    A review can be saved once and cannot be edited afterwards.
                  </p>
                  <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={!decision} loading={saving}>
                    Save review
                  </Button>
                </>
              ) : null}
            </Panel>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={save}
        loading={saving}
        tone={isOverride ? "danger" : "default"}
        title={isOverride ? `Override the model and mark ${titleCase(decision)}?` : `Confirm ${titleCase(decision)}?`}
        description={
          <>
            The final verdict will be <strong className="text-ink">{titleCase(decision)}</strong>
            {pdfAllowed ? " and PDF export will be enabled" : " and PDF export will stay disabled"}. Reviews cannot be changed after saving.
          </>
        }
        confirmLabel="Save review"
      />
    </>
  );
}
