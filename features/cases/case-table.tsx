"use client";

import { ChevronLeft, ChevronRight, Flag, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { EmptyState, LoadError } from "@/components/feedback/states";
import { PriorityLabel, VerdictBadge, WorkflowBadge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/controls";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatDate, formatPercent, formatRelativeTime } from "@/lib/format";
import { caseMatchesSearch } from "@/stores/cases";
import { PRIORITIES, type CaseSummary } from "@/types/case";

// Case list with the mobile filter set (filtercases.tsx): quick verdict filter,
// priority, sort, and free-text search across code, subject, examiner, type,
// date and verdict.

type Mode = "user" | "admin";
type SortKey = "Newest first" | "Oldest first" | "Suspected first" | "Genuine first";
const SORTS: SortKey[] = ["Newest first", "Oldest first", "Suspected first", "Genuine first"];
const SORT_OPTIONS = SORTS.map((value) => ({ value, label: value }));
const PRIORITY_OPTIONS = [{ value: "All", label: "All priorities" }, ...PRIORITIES.map((value) => ({ value: value as string, label: value }))];
/** Numbered pages with ellipses, at most 7 slots so the row stays one line. */
const pageItems = (page: number, pageCount: number): Array<number | "ellipsis-start" | "ellipsis-end"> => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis-end", pageCount];
  if (page >= pageCount - 3) return [1, "ellipsis-start", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  return [1, "ellipsis-start", page - 1, page, page + 1, "ellipsis-end", pageCount];
};

function verdictOptions(mode: Mode) {
  const values = mode === "admin" ? ["All", "Genuine", "Suspected", "Pending"] : ["All", "Genuine", "Suspected", "Processing"];
  return values.map((value) => ({ value, label: value }));
}

/** Maps a `?filter=` link (stat cards, dashboards) to the matching quick filter. */
export function verdictFromParam(param: string | null, mode: Mode) {
  const value = { genuine: "Genuine", suspected: "Suspected", pending: "Pending", processing: "Processing" }[param ?? ""];
  return value && verdictOptions(mode).some((option) => option.value === value) ? value : "All";
}

function applyVerdict(item: CaseSummary, verdict: string, mode: Mode) {
  if (verdict === "All") return true;
  if (verdict === "Pending") return mode === "admin" ? item.workflowStatus === "PendingReview" : false;
  if (verdict === "Processing") return item.workflowStatus === "Processing";
  return item.status === verdict;
}

function modelStatus(item: CaseSummary) {
  const verdict = item.verdict?.toUpperCase();
  return verdict === "FORGED" ? "Suspected" : verdict === "GENUINE" ? "Genuine" : null;
}

function sortCases(cases: CaseSummary[], sort: SortKey) {
  const byDate = (a: CaseSummary, b: CaseSummary) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const sorted = [...cases];
  if (sort === "Oldest first") return sorted.sort((a, b) => -byDate(a, b));
  if (sort === "Suspected first" || sort === "Genuine first") {
    const first = sort === "Suspected first" ? "Suspected" : "Genuine";
    return sorted.sort((a, b) => Number(b.status === first) - Number(a.status === first) || byDate(a, b));
  }
  return sorted.sort(byDate);
}

// Full class names so Tailwind can see them. Headers and cells only become table
// cells from md up (below that rows render as stacked cards).
const COLUMN_VISIBILITY = {
  user: { examiner: "", priority: "md:@3xl:table-cell", document: "md:@4xl:table-cell", review: "" },
  admin: {
    examiner: "md:@3xl:table-cell",
    priority: "md:@4xl:table-cell",
    document: "md:@5xl:table-cell",
    review: "md:@6xl:table-cell",
  },
} as const;

const ARROW =
  "pressable flex size-9 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-2 hover:border-ink-4/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 sm:size-8";

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  return (
    <nav aria-label="Case pages" className="flex items-center gap-1">
      <button type="button" className={ARROW} onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page">
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      {/* Phones: a compact counter; numbered pages from sm up. */}
      <span className="px-2 text-[13px] font-medium text-ink-2 tabular sm:hidden" aria-live="polite">
        Page {page} of {pageCount}
      </span>
      <div className="hidden items-center gap-1 sm:flex">
        {pageItems(page, pageCount).map((item) =>
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              aria-label={`Page ${item}`}
              onClick={() => onChange(item)}
              className={cn(
                "pressable flex size-8 items-center justify-center rounded-md text-[12.5px] font-semibold tabular transition-colors duration-150",
                item === page ? "bg-brand text-white" : "text-ink-2 hover:bg-sunken hover:text-ink",
              )}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="flex size-8 items-center justify-center text-ink-4" aria-hidden>
              …
            </span>
          ),
        )}
      </div>
      <button type="button" className={ARROW} onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Next page">
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}

export function CaseTable({
  cases,
  mode,
  hrefFor,
  isLoading,
  error,
  onRetry,
  initialVerdict = "All",
  limit,
  toolbar = true,
  dateColumn = "created",
  pageSize,
}: {
  cases: CaseSummary[];
  mode: Mode;
  hrefFor: (item: CaseSummary) => string;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  initialVerdict?: string;
  limit?: number;
  toolbar?: boolean;
  /** "waiting" shows how long each case has waited instead of its creation date (review queues). */
  dateColumn?: "created" | "waiting";
  /** Paginates the filtered, sorted list; search and filters always cover every case. */
  pageSize?: number;
}) {
  const [query, setQueryValue] = useState("");
  const [verdict, setVerdictValue] = useState(initialVerdict);
  const [priority, setPriorityValue] = useState("All");
  const [sort, setSortValue] = useState<SortKey>("Newest first");
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  // Any change to what's listed starts again from the first page.
  const resetting =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };
  const setQuery = resetting(setQueryValue);
  const setVerdict = resetting(setVerdictValue);
  const setPriority = resetting(setPriorityValue);
  const setSort = resetting(setSortValue);

  const matching = useMemo(() => {
    const filtered = cases.filter(
      (item) =>
        applyVerdict(item, verdict, mode) &&
        (priority === "All" || item.priority === priority) &&
        caseMatchesSearch(item, query, mode),
    );
    const sorted = sortCases(filtered, sort);
    return limit ? sorted.slice(0, limit) : sorted;
  }, [cases, limit, mode, priority, query, sort, verdict]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(matching.length / pageSize)) : 1;
  // Clamp when the list shrinks under the current page (e.g. a live update).
  const currentPage = Math.min(page, pageCount);
  const firstIndex = pageSize ? (currentPage - 1) * pageSize : 0;
  const visible = pageSize ? matching.slice(firstIndex, firstIndex + pageSize) : matching;

  const goToPage = (next: number) => {
    setPage(Math.min(pageCount, Math.max(1, next)));
    // Bring the top of the list back into view; the controls sit below it.
    const top = topRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) topRef.current?.scrollIntoView({ block: "start" });
  };

  // Secondary columns appear by the table's own width (container queries), not the
  // viewport's, because the same table sits full-width on list pages and beside a
  // side panel on dashboards. Each step leaves room for the longest case codes.
  const columns = COLUMN_VISIBILITY[mode];

  const filtersActive = Boolean(query.trim()) || verdict !== "All" || priority !== "All";

  return (
    <div ref={topRef} className="scroll-mt-20">
      {toolbar ? (
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative block flex-1 xl:max-w-sm">
            <span className="sr-only">Search cases</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-4" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search case, subject, examiner, date…"
              className="h-10 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-4 focus:border-brand focus:shadow-[0_0_0_3px_rgb(30_111_217/0.14)]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Verdict" value={verdict} onChange={setVerdict} options={verdictOptions(mode)} />
            <Select
              label="Priority"
              value={priority}
              onChange={setPriority}
              options={PRIORITY_OPTIONS}
              className="min-w-36"
            />
            <Select label="Sort" value={sort} onChange={setSort} options={SORT_OPTIONS} className="min-w-40" />
          </div>
        </div>
      ) : null}

      <div className="@container overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        {error && cases.length === 0 ? (
          <LoadError message={error} onRetry={onRetry} />
        ) : isLoading && cases.length === 0 ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          filtersActive ? (
            <EmptyState compact title="No cases match these filters" description="Try a different search or clear the filters." />
          ) : (
            <EmptyState
              illustration="/illustrations/noCase.webp"
              title="No cases yet"
              description={mode === "admin" ? "Cases created by your examiners will appear here." : "Start a new analysis to create your first case."}
            />
          )
        ) : (
          <table className="w-full text-left text-[13.5px]">
            <thead className="hidden border-b border-line bg-canvas text-[12px] font-semibold text-ink-3 md:table-header-group">
              <tr>
                <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold">Case</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Subject</th>
                {mode === "admin" ? <th scope="col" className={cn("hidden px-3 py-2.5 font-semibold", columns.examiner)}>Examiner</th> : null}
                <th scope="col" className={cn("hidden px-3 py-2.5 font-semibold", columns.document)}>Document</th>
                <th scope="col" className={cn("hidden px-3 py-2.5 font-semibold", columns.priority)}>Priority</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Verdict</th>
                {mode === "admin" ? <th scope="col" className={cn("hidden px-3 py-2.5 font-semibold", columns.review)}>Review</th> : null}
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">{dateColumn === "waiting" ? "Waiting" : "Created"}</th>
                <th scope="col" className="w-11 pr-5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((item) => {
                const unseen = mode === "user" && item.workflowStatus !== "Processing" && item.resultViewed === false;
                return (
                  <tr key={item.caseId} className="group relative flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-canvas md:table-row md:p-0">
                    <td className="font-semibold whitespace-nowrap text-ink md:py-3.5 md:pr-3 md:pl-5">
                      <Link href={hrefFor(item)} className="after:absolute after:inset-0 focus-visible:outline-none">
                        <span className="tabular">{item.caseCode}</span>
                      </Link>
                      {unseen ? <span className="ml-2 inline-block size-2 rounded-full bg-brand align-middle" title="New result" /> : null}
                      {item.isFlaggedForInternalReview ? (
                        <Flag className="ml-2 inline size-3.5 text-caution" aria-label="Flagged for internal review" />
                      ) : null}
                    </td>
                    {/* w-full + max-w-0 makes Subject the column that absorbs spare width and truncates first. */}
                    <td className="w-full text-ink-2 md:max-w-0 md:px-3">
                      <span className="block truncate" title={item.subjectName || undefined}>{item.subjectName || "—"}</span>
                    </td>
                    {mode === "admin" ? <td className={cn("hidden truncate text-ink-2 md:max-w-45 md:px-3", columns.examiner)}>{item.examiner || "—"}</td> : null}
                    <td className={cn("hidden whitespace-nowrap text-ink-2 md:px-3", columns.document)}>
                      {item.documentType === "Other" && item.otherDocumentType ? item.otherDocumentType : item.documentType}
                    </td>
                    <td className={cn("hidden whitespace-nowrap md:px-3", columns.priority)}>
                      <PriorityLabel priority={item.priority} />
                    </td>
                    <td className="whitespace-nowrap md:px-3">
                      <span className="inline-flex items-center gap-2">
                        <VerdictBadge status={item.status} />
                        {/* The model confidence belongs to the model's own verdict; hide it when a review overrode that verdict. */}
                        {item.status !== "Processing" && item.confidence !== undefined && modelStatus(item) === item.status ? (
                          <span className="hidden text-[12.5px] text-ink-3 tabular sm:inline" title="Model confidence">
                            {formatPercent(item.confidence)}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    {mode === "admin" ? (
                      <td className={cn("hidden whitespace-nowrap md:px-3", columns.review)}>
                        <WorkflowBadge status={item.workflowStatus} />
                      </td>
                    ) : null}
                    <td className="ml-auto text-right whitespace-nowrap text-ink-3 tabular md:px-3" title={dateColumn === "waiting" ? formatDate(item.createdAt) : undefined}>
                      {dateColumn === "waiting" ? formatRelativeTime(item.createdAt).replace(/ ago$/, "") : formatDate(item.createdAt)}
                    </td>
                    <td className="hidden pr-5 text-ink-4 md:table-cell">
                      <ChevronRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {toolbar && matching.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-3">
          <p className="tabular">
            Showing {firstIndex + 1}–{firstIndex + visible.length} of {matching.length}{" "}
            {filtersActive ? "matching " : ""}case{matching.length === 1 ? "" : "s"}
          </p>
          {pageCount > 1 ? <Pagination page={currentPage} pageCount={pageCount} onChange={goToPage} /> : null}
        </div>
      ) : null}
    </div>
  );
}
