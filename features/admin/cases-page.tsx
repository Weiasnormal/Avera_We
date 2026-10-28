"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { PageHeader } from "@/components/ui/panel";
import { CaseTable } from "@/features/cases/case-table";
import { useCases } from "@/hooks/use-cases";
import { routes } from "@/lib/routes";
import { useAdminStore } from "@/stores/admin";

/** Organization cases (mobile admin_cases.tsx); ?examiner= narrows to one member's history. */
export function AdminCases() {
  const params = useSearchParams();
  const examinerId = params.get("examiner");
  const { cases, error, reload, isInitialLoading } = useCases();
  const member = useAdminStore((state) => state.members.find((item) => item.id === examinerId));

  const scoped = useMemo(
    () =>
      examinerId ? cases.filter((item) => item.ownerUserId?.toLowerCase() === examinerId.toLowerCase()) : cases,
    [cases, examinerId],
  );

  return (
    <>
      <PageHeader
        title="Cases"
        description="All signature analyses in your organization. Open a case to review the verdict."
        actions={
          examinerId ? (
            <Link
              href={routes.admin.cases}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-3 text-[12.5px] font-semibold text-brand-strong"
            >
              Examiner: {member ? `${member.firstName} ${member.lastName}` : "selected"}
              <X className="size-3.5" aria-label="Clear examiner filter" />
            </Link>
          ) : undefined
        }
      />
      <CaseTable
        cases={scoped}
        mode="admin"
        hrefFor={(item) => routes.admin.caseReview(item.caseId)}
        isLoading={isInitialLoading}
        error={error}
        onRetry={() => void reload()}
        initialVerdict={params.get("filter") === "pending" ? "Pending" : "All"}
      />
    </>
  );
}
