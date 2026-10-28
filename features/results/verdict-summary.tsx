import { AlertCircle, CircleCheck, Clock, UserCheck } from "lucide-react";

import { Fact } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { formatDate, formatDuration, formatPercent } from "@/lib/format";
import type { CaseDetail } from "@/types/case";

import { titleCase, type ResolvedVerdict } from "./verdict";

/** The system's overall result, kept visually separate from the evidence. */
export function VerdictSummary({ detail, verdict }: { detail: CaseDetail; verdict: ResolvedVerdict }) {
  const suspected = verdict.displayed === "SUSPECTED";
  const pending = verdict.displayed === null;
  const Icon = pending ? Clock : suspected ? AlertCircle : CircleCheck;

  return (
    <section
      aria-label="Verdict"
      className={cn(
        "rounded-lg border px-5 py-5 sm:px-6",
        pending ? "border-line bg-surface" : suspected ? "border-suspect-line bg-suspect-soft" : "border-genuine-line bg-genuine-soft",
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full text-white",
            pending ? "bg-ink-4" : suspected ? "bg-suspect" : "bg-genuine",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-ink-3">
            {verdict.isReviewed ? "Final verdict · reviewed" : "Model verdict"}
          </p>
          <p className={cn("text-[28px] leading-tight font-bold tracking-[-0.02em]", pending ? "text-ink-2" : suspected ? "text-suspect" : "text-genuine")}>
            {verdict.isReviewed ? (
              titleCase(verdict.displayed)
            ) : (
              <>
                <span className="tabular">{formatPercent(verdict.modelConfidence)}</span> {titleCase(verdict.displayed)}
              </>
            )}
          </p>
          {verdict.isReviewed && verdict.model ? (
            <p className="mt-0.5 text-[13px] text-ink-2">
              {verdict.isOverride ? "Admin override" : "Confirmed by admin"} · Model: {formatPercent(verdict.modelConfidence)}{" "}
              {titleCase(verdict.model)}
            </p>
          ) : null}
        </div>
      </div>

      {detail.mlResponse ? (
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink/8 pt-4 sm:grid-cols-4">
          <Fact label="Confidence · genuine" value={<span className="tabular">{formatPercent(detail.mlResponse.confidenceGenuine)}</span>} />
          <Fact label="Confidence · forged" value={<span className="tabular">{formatPercent(detail.mlResponse.confidenceForged)}</span>} />
          <Fact label="Embedding distance" value={<span className="tabular">{detail.mlResponse.distance.toFixed(4)}</span>} />
          <Fact label="Decision threshold" value={<span className="tabular">{detail.mlResponse.threshold.toFixed(4)}</span>} />
        </dl>
      ) : null}
    </section>
  );
}

export function CaseFacts({ detail, showExaminer }: { detail: CaseDetail; showExaminer?: boolean }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
      <Fact label="Subject" value={detail.subjectName || "—"} />
      {showExaminer ? <Fact label="Examiner" value={detail.examiner || "—"} /> : null}
      <Fact
        label="Document type"
        value={detail.documentType === "Other" && detail.otherDocumentType ? detail.otherDocumentType : detail.documentType}
      />
      <Fact label="Priority" value={detail.priority} />
      <Fact label="Created" value={formatDate(detail.createdAt)} />
      <Fact label="Processing time" value={<span className="tabular">{formatDuration(detail.timeElapsedMs)}</span>} />
      {!showExaminer ? (
        <Fact label="Status" value={detail.caseStatus === "PendingReview" ? "Pending review" : detail.caseStatus} />
      ) : null}
    </dl>
  );
}

/** Mobile VerdictCard: supervisor review state shown to the examiner. */
export function ReviewStatus({ detail, verdict }: { detail: CaseDetail; verdict: ResolvedVerdict }) {
  if (!verdict.isReviewed) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-brand-line bg-brand-soft/50 px-4 py-3.5">
        <Clock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <div>
          <p className="text-[14px] font-semibold text-ink">Pending supervisor review</p>
          <p className="mt-0.5 text-[13px] text-ink-2">This result is awaiting review. The final verdict may be updated by your supervisor.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3.5">
      <UserCheck className={cn("mt-0.5 size-4 shrink-0", verdict.displayed === "SUSPECTED" ? "text-suspect" : "text-genuine")} aria-hidden />
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">{verdict.isOverride ? "Verdict updated by supervisor" : "Verdict confirmed by supervisor"}</p>
        <p className="mt-0.5 text-[13px] text-ink-2">
          {verdict.isOverride ? (
            <>
              Changed from <strong>{titleCase(verdict.model)}</strong> to <strong>{titleCase(verdict.reviewed)}</strong>
            </>
          ) : (
            <>
              Confirmed as <strong>{titleCase(verdict.reviewed)}</strong>
            </>
          )}
          {detail.reviewedAt ? ` on ${formatDate(detail.reviewedAt)}` : ""}.
        </p>
        {detail.reviewNote ? (
          <blockquote className="mt-2 rounded-md bg-canvas px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">
            {detail.reviewNote}
          </blockquote>
        ) : null}
      </div>
    </div>
  );
}
