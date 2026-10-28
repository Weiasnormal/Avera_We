"use client";

import { NewAnalysisButton } from "@/components/navigation/new-analysis-button";
import { PageHeader } from "@/components/ui/panel";
import { CaseTable } from "@/features/cases/case-table";
import { useCases } from "@/hooks/use-cases";
import { routes } from "@/lib/routes";

export function ExaminerCases() {
  const { cases, error, reload, isInitialLoading } = useCases();
  return (
    <>
      <PageHeader title="Cases" description="Every signature analysis you have submitted." actions={<NewAnalysisButton />} />
      <CaseTable
        cases={cases}
        mode="user"
        hrefFor={(item) =>
          item.workflowStatus === "Processing" ? routes.examiner.processing(item.caseId) : routes.examiner.caseResult(item.caseId)
        }
        isLoading={isInitialLoading}
        error={error}
        onRetry={() => void reload()}
      />
    </>
  );
}
