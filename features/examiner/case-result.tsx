"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { EmptyState, LoadError } from "@/components/feedback/states";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { CaseDetailSkeleton, CaseHeader } from "@/features/results/case-header";
import { EvidenceViewer } from "@/features/results/evidence-viewer";
import { ReportActions } from "@/features/results/report-actions";
import { resolveVerdict } from "@/features/results/verdict";
import { CaseFacts, ReviewStatus, VerdictSummary } from "@/features/results/verdict-summary";
import { useCaseDetail } from "@/hooks/use-case-detail";
import { routes } from "@/lib/routes";
import { useCasesStore } from "@/stores/cases";

/** Examiner view of a finished case (mobile signature_results.tsx). */
export function CaseResult({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { detail, error, loading, reload } = useCaseDetail(caseId);
  const markViewed = useCasesStore((state) => state.markViewed);

  useEffect(() => {
    if (!detail) return;
    if (detail.caseStatus === "Processing") {
      router.replace(routes.examiner.processing(caseId));
      return;
    }
    markViewed(caseId);
  }, [caseId, detail, markViewed, router]);

  if (loading && !detail) return <CaseDetailSkeleton />;
  if (error && !detail) return <LoadError message={error} onRetry={() => void reload()} />;
  if (!detail || detail.caseStatus === "Processing") return <CaseDetailSkeleton />;

  const verdict = resolveVerdict(detail);

  return (
    <>
      <CaseHeader
        detail={detail}
        backHref={routes.examiner.cases}
        backLabel="Cases"
        actions={
          <ReportActions
            caseId={caseId}
            caseCode={detail.caseCode}
            allowed={detail.isPdfExportAllowed}
            disabledReason="PDF export has not been enabled by an administrator."
          />
        }
      />

      {!detail.mlResponse ? (
        <Panel>
          <EmptyState
            title="No analysis results found"
            description="The server has no analysis output for this case yet."
            action={<ButtonLink href={routes.examiner.processing(caseId)}>Open processing</ButtonLink>}
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-5">
          <VerdictSummary detail={detail} verdict={verdict} />
          <ReviewStatus detail={detail} verdict={verdict} />
          <Panel>
            <CaseFacts detail={detail} />
          </Panel>
          <EvidenceViewer caseId={caseId} overlays={detail.mlResponse.gradCamResults} />
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Avera is an assistive verification tool. The model verdict and its visual explanations support, but do not
            replace, the judgement of a qualified forensic document examiner.
          </p>
        </div>
      )}
    </>
  );
}
