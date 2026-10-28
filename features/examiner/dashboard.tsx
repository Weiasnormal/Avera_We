"use client";

import { ArrowRight, CalendarPlus, FileClock, FilePen, FileSearch, FolderOpen, LoaderCircle, CircleAlert, CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Alert, EmptyState } from "@/components/feedback/states";
import { NewAnalysisButton, useCaseLimit } from "@/components/navigation/new-analysis-button";
import { PageHeader, Panel } from "@/components/ui/panel";
import { StatCards } from "@/components/ui/stat-cards";
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

// Blue = in progress or yours to open (never green: a ready result can be Suspected).
const KIND_META = {
  draft: { label: "Draft", icon: FilePen, tile: "bg-sunken text-ink-2", text: "text-ink-3" },
  processing: { label: "Processing", icon: FileClock, tile: "bg-brand-soft text-brand", text: "text-brand" },
  result: { label: "Result ready", icon: FileSearch, tile: "bg-brand-soft text-brand", text: "text-brand" },
} as const;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** One sentence under the greeting saying what is waiting, in priority order. */
function attentionSummary(pending: PendingItem[]) {
  const count = (kind: PendingItem["kind"]) => pending.filter((entry) => entry.kind === kind).length;
  const parts = [
    count("result") ? plural(count("result"), "result is ready to open", "results are ready to open") : null,
    count("processing") ? plural(count("processing"), "analysis is still running", "analyses are still running") : null,
    count("draft") ? plural(count("draft"), "draft to finish", "drafts to finish") : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(", ")}.` : "You\u2019re all caught up.";
}

const percentOf = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}% of verdicts` : undefined);

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

  const summary = useMemo(() => {
    const now = new Date();
    return {
      total: cases.length,
      genuine: cases.filter((item) => item.status === "Genuine").length,
      suspected: cases.filter((item) => item.status === "Suspected").length,
      processing: cases.filter((item) => item.workflowStatus === "Processing").length,
      thisMonth: cases.filter((item) => {
        const created = new Date(item.createdAt);
        return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
      }).length,
    };
  }, [cases]);
  const decided = summary.genuine + summary.suspected;

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
        description={isInitialLoading ? profile?.organization || undefined : attentionSummary(pending)}
        actions={<NewAnalysisButton className="lg:hidden" />}
      />

      {reached ? (
        <Alert tone="caution" className="mb-6" title="Daily case limit reached">
          You have created {casesToday} of {limit} cases allowed today. Contact your admin to raise the limit.
        </Alert>
      ) : null}

      <StatCards
        className="mb-8"
        stats={[
          {
            label: "Total cases",
            value: summary.total,
            meta: `${summary.thisMonth} this month`,
            icon: FolderOpen,
            tone: "brand",
            href: routes.examiner.cases,
            loading: isInitialLoading,
          },
          {
            label: "Genuine",
            value: summary.genuine,
            meta: percentOf(summary.genuine, decided),
            icon: CircleCheck,
            tone: "genuine",
            href: `${routes.examiner.cases}?filter=genuine`,
            loading: isInitialLoading,
          },
          {
            label: "Suspected",
            value: summary.suspected,
            meta: percentOf(summary.suspected, decided),
            icon: CircleAlert,
            tone: "suspect",
            href: `${routes.examiner.cases}?filter=suspected`,
            loading: isInitialLoading,
          },
          limit !== null
            ? {
                label: "Created today",
                value: (
                  <>
                    {casesToday}
                    <span className="text-[0.6em] font-semibold text-ink-4"> / {limit}</span>
                  </>
                ),
                progress: { value: casesToday, max: limit },
                icon: CalendarPlus,
                tone: "brand",
                loading: isInitialLoading,
              }
            : {
                label: "Processing",
                value: summary.processing,
                icon: LoaderCircle,
                tone: "brand",
                href: `${routes.examiner.cases}?filter=processing`,
                loading: isInitialLoading,
              },
        ]}
      />

      {/* Four columns from xl: the side panel is exactly one card wide, so its edges line up with the cards. */}
      <div className="grid gap-5 xl:grid-cols-4">
        <section className="min-w-0 xl:col-span-3">
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
            limit={8}
            hrefFor={(item) =>
              item.workflowStatus === "Processing" ? routes.examiner.processing(item.caseId) : routes.examiner.caseResult(item.caseId)
            }
            isLoading={isInitialLoading}
            error={error}
            onRetry={() => void reload()}
          />
        </section>

        <Panel title="Needs attention" description="Drafts, analyses and new results" bodyClassName="p-0">
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
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${meta.tile}`}>
                        <Icon className="size-4.25" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[11.5px] font-semibold ${meta.text}`}>{meta.label}</span>
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{entry.title}</span>
                        <span className="block truncate text-[12.5px] text-ink-3">{entry.detail}</span>
                      </span>
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
