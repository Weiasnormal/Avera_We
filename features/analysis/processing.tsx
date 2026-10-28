"use client";

import { AlertTriangle, Check, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { LoadingState } from "@/components/ui/avera-loader";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { fetchCaseDetail } from "@/services/cases";
import { useAnalysisStore, type ProcessingJob } from "@/stores/analysis";
import { useSessionStore } from "@/stores/session";

// Mobile processing.tsx: a progress ring over the five ML pipeline stages.
// Uploads report real progress (0–10%). The ML service answers in a single
// request, so, like the mobile app, the stages advance on a timeline that eases
// toward 95% and only completes when the verdict actually arrives.

const STAGES = [
  { label: "Image preprocessing", detail: "Normalize & enhance contrast", title: "Preprocessing…" },
  { label: "Feature extraction", detail: "Siamese network encoding", title: "Extracting features…" },
  { label: "Similarity scoring", detail: "Contrastive loss comparison", title: "Scoring similarity…" },
  { label: "Heatmap generation", detail: "Grad-CAM visualization", title: "Generating heatmap…" },
  { label: "Report compilation", detail: "Building forensic output", title: "Compiling report…" },
] as const;

const TIMELINE_MS = 10_000;
const TICK_MS = 200;

type StageState = "done" | "active" | "pending" | "failed";

function progressFor(job: ProcessingJob, now: number) {
  if (job.status === "success") return 100;
  if (!job.uploadsComplete || !job.analysisStartedAt) {
    // Store progress runs 10–65 across the five uploads; map it onto 0–9%.
    return Math.min(9, Math.max(0, Math.round(((job.progress - 10) / 55) * 10)));
  }
  const elapsed = Math.max(0, now - job.analysisStartedAt);
  return Math.floor(10 + 85 * (1 - Math.exp(-elapsed / TIMELINE_MS)));
}

function ProgressRing({ percent, tone }: { percent: number; tone: "brand" | "failed" }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative size-32" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Analysis progress">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-sunken)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={tone === "failed" ? "var(--color-suspect)" : "var(--color-brand)"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] leading-none font-bold tracking-[-0.02em] text-ink tabular">{percent}%</span>
        <span className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-ink-4">COMPLETE</span>
      </div>
    </div>
  );
}

function StageIcon({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-chart-genuine text-chart-genuine animate-popover-in">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-suspect text-suspect">
        <AlertTriangle className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
        state === "active" ? "border-brand" : "border-line-strong",
      )}
    >
      <span className={cn("rounded-full", state === "active" ? "size-2.5 bg-brand animate-[shimmer_1.2s_ease-in-out_infinite]" : "size-1.5 bg-line-strong")} />
    </span>
  );
}

const STATE_LABEL: Record<StageState, { text: string; className: string }> = {
  done: { text: "Done", className: "text-chart-genuine" },
  active: { text: "Running", className: "text-brand" },
  pending: { text: "—", className: "text-ink-4" },
  failed: { text: "Failed", className: "text-suspect" },
};

/** Centered card shared by every processing state. */
function ProcessingCard({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-140 overflow-hidden rounded-xl border border-line bg-surface shadow-card animate-rise-in">
      {children}
      <div className="flex flex-col gap-4 border-t border-line px-5 py-5 sm:px-7">{footer}</div>
    </div>
  );
}

function FooterNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[12.5px] text-ink-4">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
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
  const [now, setNow] = useState(0);

  const analyzing = job?.status === "submitting" && Boolean(job.analysisStartedAt);

  // Advance the stage timeline while the ML request is in flight; it freezes on failure.
  useEffect(() => {
    if (!analyzing) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [analyzing]);

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

  // Let the ring land on 100% before opening the result.
  useEffect(() => {
    if (job?.status !== "success") return;
    const timer = setTimeout(() => router.replace(routes.examiner.caseResult(caseId)), 900);
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

  const homeButton = (variant: "primary" | "secondary" = "primary") => (
    <ButtonLink href={routes.examiner.dashboard} variant={variant} size="lg" className="w-full">
      Back to Home
    </ButtonLink>
  );

  if (!job) {
    return (
      <ProcessingCard
        footer={
          orphan.status === "processing" ? (
            <div className="flex flex-col gap-2.5">
              <Button size="lg" className="w-full" onClick={() => void runRetry()} loading={retrying}>
                Retry analysis
              </Button>
              {homeButton("secondary")}
            </div>
          ) : (
            homeButton(orphan.status === "error" ? "primary" : "secondary")
          )
        }
      >
        <div className="px-5 py-8 text-center sm:px-7">
          {orphan.status === "checking" ? (
            <LoadingState label="Checking the case status…" className="py-4" />
          ) : orphan.status === "error" ? (
            <>
              <p className="text-[17px] font-bold text-ink">Couldn&apos;t load this case</p>
              <p className="mt-1.5 text-[13.5px] text-danger">{orphan.message}</p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-bold text-ink">Case {orphan.caseCode} has no result yet</p>
              <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] text-ink-3">
                The analysis may have been interrupted when this tab was closed or reloaded. The uploaded signatures are saved,
                so you can re-run it without uploading them again.
              </p>
            </>
          )}
        </div>
      </ProcessingCard>
    );
  }

  const failed = job.status === "error";
  const succeeded = job.status === "success";
  const percent = progressFor(job, now);
  // -1 while uploading ("Initializing"), then one stage per 20%.
  const activeIndex = succeeded ? STAGES.length : percent < 10 ? -1 : Math.min(STAGES.length - 1, Math.floor(percent / 20));
  const failedIndex = failed ? Math.max(0, activeIndex) : null;

  const stateFor = (index: number): StageState => {
    if (failedIndex !== null) return index < failedIndex ? "done" : index === failedIndex && job.uploadsComplete ? "failed" : "pending";
    if (index < activeIndex) return "done";
    return index === activeIndex ? "active" : "pending";
  };

  const heading = failed
    ? { title: "Processing interrupted", subtitle: job.error ?? "Something went wrong." }
    : succeeded
      ? { title: "Analysis complete", subtitle: "Opening the result…" }
      : activeIndex < 0
        ? { title: "Initializing…", subtitle: job.step || "Preparing signature images" }
        : { title: STAGES[activeIndex].title, subtitle: STAGES[activeIndex].detail };

  return (
    <ProcessingCard
      footer={
        <>
          <FooterNote>
            {failed
              ? job.uploadsComplete
                ? "This case is saved. You can retry without re-uploading."
                : "The upload did not finish. Start over to upload the signatures again."
              : "Processing continues in the background. We'll notify you when it's complete."}
          </FooterNote>
          {failed ? (
            <div className="flex flex-col gap-2.5">
              {job.uploadsComplete ? (
                <Button size="lg" className="w-full" onClick={() => void runRetry()} loading={retrying}>
                  Retry analysis
                </Button>
              ) : (
                <ButtonLink href={routes.examiner.newAnalysis} size="lg" className="w-full">
                  Start over with new uploads
                </ButtonLink>
              )}
              {homeButton("secondary")}
            </div>
          ) : (
            homeButton()
          )}
        </>
      }
    >
      <div className="flex flex-col items-center px-5 pt-8 pb-7 text-center sm:px-7" aria-live="polite">
        <ProgressRing percent={percent} tone={failed ? "failed" : "brand"} />
        <h1 key={heading.title} className="mt-5 text-[22px] font-bold tracking-[-0.015em] text-ink animate-fade-in">
          {heading.title}
        </h1>
        <p className={cn("mt-1 text-[13.5px]", failed ? "text-danger" : "text-ink-3")}>{heading.subtitle}</p>
        <p className="mt-3 rounded-full bg-sunken px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-3 tabular">Case {job.caseCode}</p>
      </div>

      <ol className="border-t border-line px-5 sm:px-7">
        {STAGES.map((stage, index) => {
          const state = stateFor(index);
          const label = STATE_LABEL[state];
          return (
            <li key={stage.label} className="flex items-center gap-3.5 border-b border-line py-3.5 last:border-b-0">
              <StageIcon key={state} state={state} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">{stage.label}</p>
                <p className="text-[12.5px] text-ink-4">{stage.detail}</p>
              </div>
              <span className={cn("text-[12px] font-semibold transition-colors duration-200", label.className)}>{label.text}</span>
            </li>
          );
        })}
      </ol>
    </ProcessingCard>
  );
}
