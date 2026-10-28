"use client";

import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/ui/panel";
import { CaseTable, verdictFromParam } from "@/features/cases/case-table";
import { useCases } from "@/hooks/use-cases";
import { routes } from "@/lib/routes";

/** Examiner cases; ?filter= (from the dashboard cards) preselects the verdict filter. */
export function ExaminerCases() {
  const params = useSearchParams();
  const { cases, error, reload, isInitialLoading } = useCases();
  return (
    <>
      <PageHeader title="Cases" description="Every signature analysis you have submitted." />
      <CaseTable
        // Remount when a dashboard link changes the filter on this same route.
        key={params.get("filter") ?? "all"}
        cases={cases}
        mode="user"
        hrefFor={(item) =>
          item.workflowStatus === "Processing" ? routes.examiner.processing(item.caseId) : routes.examiner.caseResult(item.caseId)
        }
        isLoading={isInitialLoading}
        error={error}
        onRetry={() => void reload()}
        initialVerdict={verdictFromParam(params.get("filter"), "user")}
        pageSize={25}
      />
    </>
  );
}
