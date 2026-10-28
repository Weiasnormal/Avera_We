"use client";

import { AlertTriangle, Check, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/panel";
import { LoadingState } from "@/components/ui/avera-loader";
import { IndeterminateBar, Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { fetchCaseDetail } from "@/services/cases";
import { useAnalysisStore, type ProcessingJob } from "@/stores/analysis";
import { useSessionStore } from "@/stores/session";

// Mobile processing.tsx. The mobile screen animated a simulated progress ring
// through ML stage names; here each row reflects a request that actually ran.

type StageState = "done" | "active" | "pending" | "failed";

function stagesFor(job: ProcessingJob | undefined) {
  const progress = job?.progress ?? 0;
  const failed = job?.status === "error";
  const uploadsDone = job?.uploadsComplete ?? false;
  const complete = job?.status === "success";
  const referenceMatch = job?.step.match(/reference (\d) of 4/);
  const referencesUploaded = referenceMatch ? Number(referenceMatch[1]) - 1 : progress >= 55 ? 4 : 0;

  const rows: { label: string; detail: string; state: StageState }[] = [
    { label: "Case created", detail: job ? job.caseCode : "", state: job ? "done" : "active" },
    {
      label: "Reference signatures uploaded",
      detail: `${uploadsDone ? 4 : referencesUploaded} of 4`,
      state: uploadsDone || progress >= 55 ? "done" : "active",
    },
    {
      label: "Suspected signature uploaded",
      detail: "1 image",
      state: uploadsDone ? "done" : progress >= 55 ? "active" : "pending",
    },
    {
      label: "AI forensic comparison",
      detail: "Siamese network scoring and Grad-CAM evidence, run by the Avera ML service",
      state: complete ? "done" : uploadsDone ? "active" : "pending",
    },
  ];
  if (failed) {
    const index = rows.findIndex((row) => row.state === "active");
    if (index >= 0) rows[index].state = "failed";
  }
  return rows;
}

export function Processing({ caseId }: { caseId: string }) {
  const router = useRouter();
  const job = useAnalysisStore((state) => state.jobs[caseId]);
  const retry = useAnalysisStore((state) => state.retry);
  const tenantId = useSessionStore((state) => state.claims?.tenantId);
  const [orphan, setOrphan] = useState<{ status: "checking" | "processing" | "error"; caseCode?: string; message?: string }>({
    status: "checking",
  });
  const [retrying, setRetrying] = useState(false);

  // No in-memory job (page reloaded or opened from the case list): ask the backend.
  useEffect(() => {
    if (job) return;
    let cancelled = false;
    fetchCaseDetail(caseId, tenantId)
      .then((detail) => {
        if (cancelled) return;
        if (detail.caseStatus !== "Processing") router.replace(routes.examiner.caseResult(caseId));
        else setOrphan({ status: "processing", caseCode: detail.caseCode });
      })
      .catch((error) => !cancelled && setOrphan({ status: "error", message: error instanceof Error ? error.message : "Unable to load this case." }));
    return () => {
      cancelled = true;
    };
  }, [caseId, job, router, tenantId]);

  useEffect(() => {
    if (job?.status !== "success") return;
    const timer = setTimeout(() => router.replace(routes.examiner.caseResult(caseId)), 700);
    return () => clearTimeout(timer);
  }, [caseId, job?.status, router]);

  const runRetry = async () => {
    setRetrying(true);
    try {
      await retry(caseId, job?.caseCode ?? orphan.caseCode);
    } catch {
      // The job now carries the error message.
    } finally {
      setRetrying(false);
    }
  };

  const failed = job?.status === "error";
  const succeeded = job?.status === "success";
  const title = failed ? "Processing interrupted" : succeeded ? "Analysis complete" : "Analyzing signatures";

  if (!job) {
    return (
      <>
        <PageHeader title="Case processing" />
        <Panel className="max-w-160">
          {orphan.status === "checking" ? (
            <LoadingState label="Checking the case status…" className="py-6" />
          ) : orphan.status === "error" ? (
            <div className="flex flex-col items-start gap-4">
              <p className="text-[14px] text-danger">{orphan.message}</p>
              <ButtonLink href={routes.examiner.dashboard} variant="secondary">
                Back to dashboard
              </ButtonLink>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-[15px] font-semibold">Case {orphan.caseCode} has no result yet</p>
              <p className="text-[13.5px] text-ink-3">
                The analysis may have been interrupted when this tab was closed or reloaded. The uploaded signatures are
                saved, so you can re-run the analysis without uploading them again.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void runRetry()} loading={retrying}>
                  Retry analysis
                </Button>
                <ButtonLink href={routes.examiner.dashboard} variant="secondary">
                  Back to dashboard
                </ButtonLink>
              </div>
            </div>
          )}
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader title={title} description={`Case ${job.caseCode}`} />
      <Panel className="max-w-180">
        <div aria-live="polite" className="mb-6">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <p className={cn("text-[15px] font-semibold", failed ? "text-danger" : "text-ink")}>
              {failed ? job.error : succeeded ? "Opening the result…" : job.step}
            </p>
            {!failed && !succeeded && !job.uploadsComplete ? (
              <span className="text-[13px] text-ink-3 tabular">{job.progress}%</span>
            ) : null}
          </div>
          {failed ? (
            <div className="h-1 rounded-full bg-suspect-soft" />
          ) : succeeded ? (
            <div className="h-1 rounded-full bg-genuine" />
          ) : job.uploadsComplete ? (
            <IndeterminateBar />
          ) : (
            <div className="h-1 overflow-hidden rounded-full bg-brand-soft">
              <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${job.progress}%` }} />
            </div>
          )}
        </div>

        <ol className="flex flex-col">
          {stagesFor(job).map((stage) => (
            <li key={stage.label} className="flex items-start gap-3 border-t border-line py-3.5 first:border-t-0">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                  stage.state === "done" && "bg-brand text-white",
                  stage.state === "active" && "text-brand",
                  stage.state === "pending" && "border border-line-strong",
                  stage.state === "failed" && "bg-suspect-soft text-suspect",
                )}
              >
                {stage.state === "done" ? <Check className="size-3" strokeWidth={3} /> : null}
                {stage.state === "active" ? <Spinner className="size-4" /> : null}
                {stage.state === "failed" ? <AlertTriangle className="size-3" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[14px] font-semibold", stage.state === "pending" ? "text-ink-4" : "text-ink")}>{stage.label}</p>
                <p className="text-[12.5px] text-ink-3">{stage.detail}</p>
              </div>
              <span className="text-[12px] font-medium text-ink-3">
                {stage.state === "done" ? "Done" : stage.state === "active" ? "Running" : stage.state === "failed" ? "Failed" : "—"}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-col gap-4 border-t border-line pt-5">
          <p className="flex items-start gap-2 text-[12.5px] text-ink-3">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {failed
              ? job.uploadsComplete
                ? "This case is saved. You can retry without re-uploading."
                : "The upload did not finish. Start over to upload the signatures again."
              : "You can leave this page; processing continues while this tab stays open."}
          </p>
          <div className="flex flex-wrap gap-2">
            {failed && job.uploadsComplete ? (
              <Button onClick={() => void runRetry()} loading={retrying}>
                Retry analysis
              </Button>
            ) : null}
            {failed && !job.uploadsComplete ? <ButtonLink href={routes.examiner.newAnalysis}>Start over with new uploads</ButtonLink> : null}
            <ButtonLink href={routes.examiner.dashboard} variant="secondary">
              Back to dashboard
            </ButtonLink>
          </div>
        </div>
      </Panel>
    </>
  );
}
