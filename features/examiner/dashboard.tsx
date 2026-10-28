"use client";

import { ArrowRight, FileClock, FilePen, FileSearch } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Alert, EmptyState } from "@/components/feedback/states";
import { NewAnalysisButton, useCaseLimit } from "@/components/navigation/new-analysis-button";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import { CaseTable } from "@/features/cases/case-table";
import { useCases } from "@/hooks/use-cases";
import { formatRelativeTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { hasDraftProgress, useAnalysisStore, type Draft } from "@/stores/analysis";
import { useCasesStore } from "@/stores/cases";
import { useSessionStore } from "@/stores/session";
import type { CaseSummary } from "@/types/case";

type PendingItem =
  | { kind: "draft"; key: string; title: string; detail: string; draft: Draft; sortKey: number }
  | { kind: "processing" | "result"; key: string; title: string; detail: string; item: CaseSummary; sortKey: number };

const KIND_META = {
  draft: { label: "Draft", icon: FilePen, tone: "text-ink-2 bg-sunken" },
  processing: { label: "Processing", icon: FileClock, tone: "text-brand bg-brand-soft" },
  result: { label: "Result ready", icon: FileSearch, tone: "text-genuine bg-genuine-soft" },
} as const;

/** Mobile getPendingCards: drafts, cases still processing, and unopened results. */
function usePendingItems(cases: CaseSummary[]): PendingItem[] {
  const draft = useAnalysisStore((state) => state.draft);
  const savedDrafts = useAnalysisStore((state) => state.savedDrafts);
  return useMemo(() => {
    const drafts = [...savedDrafts, ...(hasDraftProgress(draft) ? [draft] : [])];
    const items: PendingItem[] = drafts.map((entry) => ({
      kind: "draft",
      key: `draft-${entry.id}`,
      title: entry.subjectName.trim() || "Draft in progress",
      detail: `${entry.documentType} · ${entry.references.filter(Boolean).length + (entry.suspect ? 1 : 0)} of 5 images`,
      draft: entry,
      // Drafts sort above cases (mobile order), newest draft first.
      sortKey: Number.MAX_SAFE_INTEGER / 2 + entry.updatedAt,
    }));
    for (const item of cases) {
      if (item.workflowStatus === "Processing") {
        items.push({
          kind: "processing",
          key: `p-${item.caseId}`,
          title: item.subjectName || item.caseCode,
          detail: `${item.caseCode} · started ${formatRelativeTime(item.createdAt)}`,
          item,
          sortKey: new Date(item.createdAt).getTime(),
        });
      } else if (item.resultViewed === false) {
        items.push({
          kind: "result",
          key: `r-${item.caseId}`,
          title: item.subjectName || item.caseCode,
          detail: `${item.caseCode} · ${item.status}`,
          item,
          sortKey: new Date(item.createdAt).getTime(),
        });
      }
    }
    return items.sort((a, b) => b.sortKey - a.sortKey);
  }, [cases, draft, savedDrafts]);
}

export function ExaminerDashboard() {
  const router = useRouter();
  const { cases, error, reload, isInitialLoading } = useCases();
  const profile = useSessionStore((state) => state.profile);
  const markViewed = useCasesStore((state) => state.markViewed);
  const pending = usePendingItems(cases);
  const { limit, casesToday, reached } = useCaseLimit();

  const summary = useMemo(
    () => ({
      total: cases.length,
      genuine: cases.filter((item) => item.status === "Genuine").length,
      suspected: cases.filter((item) => item.status === "Suspected").length,
      processing: cases.filter((item) => item.workflowStatus === "Processing").length,
    }),
    [cases],
  );

  const openPending = (entry: PendingItem) => {
    if (entry.kind === "draft") {
      useAnalysisStore.getState().openDraft(entry.draft.id);
      router.push(routes.examiner.newAnalysis);
    } else if (entry.kind === "processing") {
      router.push(routes.examiner.processing(entry.item.caseId));
    } else {
      markViewed(entry.item.caseId);
      router.push(routes.examiner.caseResult(entry.item.caseId));
    }
  };

  return (
    <>
      <PageHeader
        title={profile?.firstName ? `Welcome back, ${profile.firstName}` : "Dashboard"}
        description={profile?.organization || undefined}
        actions={<NewAnalysisButton />}
      />

      {reached ? (
        <Alert tone="caution" className="mb-6" title="Daily case limit reached">
          You have created {casesToday} of {limit} cases allowed today. Contact your admin to raise the limit.
        </Alert>
      ) : null}

      <dl className="mb-8 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface shadow-card sm:grid-cols-4">
        {[
          { label: "Total cases", value: summary.total },
          { label: "Genuine", value: summary.genuine, tone: "text-genuine" },
          { label: "Suspected", value: summary.suspected, tone: "text-suspect" },
          {
            label: limit !== null ? "Created today" : "Processing",
            value: limit !== null ? `${casesToday} / ${limit}` : summary.processing,
          },
        ].map((stat, index) => (
          <div key={stat.label} className={`px-5 py-4 ${index % 2 ? "border-l" : ""} border-line ${index >= 2 ? "border-t sm:border-t-0" : ""} ${index === 2 ? "sm:border-l" : ""}`}>
            <dt className="text-[12.5px] font-medium text-ink-3">{stat.label}</dt>
            <dd className={`mt-1 text-[22px] font-bold tabular ${stat.tone ?? "text-ink"}`}>
              {isInitialLoading ? <Skeleton className="mt-1 h-6 w-10" /> : stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Recent cases</h2>
            <Link href={routes.examiner.cases} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <CaseTable
            cases={cases}
            mode="user"
            toolbar={false}
            limit={6}
            hrefFor={(item) =>
              item.workflowStatus === "Processing" ? routes.examiner.processing(item.caseId) : routes.examiner.caseResult(item.caseId)
            }
            isLoading={isInitialLoading}
            error={error}
            onRetry={() => void reload()}
          />
        </section>

        <Panel title="Needs attention" description="Drafts, running analyses and unopened results" bodyClassName="p-0">
          {pending.length === 0 ? (
            <EmptyState compact title="You're all caught up" description="Drafts and new results will show up here." />
          ) : (
            <ul className="divide-y divide-line">
              {pending.slice(0, 8).map((entry) => {
                const meta = KIND_META[entry.kind];
                const Icon = meta.icon;
                return (
                  <li key={entry.key}>
                    <button
                      type="button"
                      onClick={() => openPending(entry)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-canvas"
                    >
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${meta.tone}`}>
                        <Icon className="size-4.25" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{entry.title}</span>
                        <span className="block truncate text-[12.5px] text-ink-3">{entry.detail}</span>
                      </span>
                      <span className="text-[12px] font-medium text-ink-3">{meta.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
