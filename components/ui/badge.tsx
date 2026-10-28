import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { AnalysisPriority, CaseStatus, CaseWorkflowStatus } from "@/types/case";

type Tone = "neutral" | "brand" | "genuine" | "suspect" | "caution";

const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2 border-line",
  brand: "bg-brand-soft text-brand-strong border-brand-line",
  genuine: "bg-genuine-soft text-genuine border-genuine-line",
  suspect: "bg-suspect-soft text-suspect border-suspect-line",
  caution: "bg-caution-soft text-caution border-caution-line",
};

export function Badge({
  tone = "neutral",
  children,
  dot = false,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function VerdictBadge({ status }: { status: CaseStatus }) {
  if (status === "Genuine") return <Badge tone="genuine" dot>Genuine</Badge>;
  if (status === "Suspected") return <Badge tone="suspect" dot>Suspected</Badge>;
  return <Badge tone="brand" dot>Processing</Badge>;
}

export function WorkflowBadge({ status }: { status: CaseWorkflowStatus }) {
  if (status === "Reviewed") return <Badge tone="neutral">Reviewed</Badge>;
  if (status === "PendingReview") return <Badge tone="caution">Pending review</Badge>;
  return <Badge tone="brand">Processing</Badge>;
}

export function PriorityLabel({ priority }: { priority: AnalysisPriority }) {
  return (
    <span className={cn("text-[13px] font-medium", priority === "Urgent" ? "text-danger" : "text-ink-2")}>
      {priority}
    </span>
  );
}
