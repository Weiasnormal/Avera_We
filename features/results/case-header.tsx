import { ArrowLeft, Flag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import type { CaseDetail } from "@/types/case";

export function CaseHeader({
  detail,
  backHref,
  backLabel,
  actions,
}: {
  detail: CaseDetail;
  backHref: string;
  backLabel: string;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      back={
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
          <ArrowLeft className="size-4" /> {backLabel}
        </Link>
      }
      title={
        <span className="flex flex-wrap items-center gap-3">
          <span className="tabular">{detail.caseCode || detail.id}</span>
          {detail.isFlaggedForInternalReview ? (
            <Badge tone="caution">
              <Flag className="size-3" aria-hidden /> Internal review
            </Badge>
          ) : null}
        </span>
      }
      description={detail.subjectName ? `Subject: ${detail.subjectName}` : undefined}
      actions={actions}
    />
  );
}

export function CaseDetailSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-105 w-full rounded-lg" />
    </div>
  );
}
