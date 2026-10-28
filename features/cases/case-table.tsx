"use client";

import { ChevronRight, Flag, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState, LoadError } from "@/components/feedback/states";
import { PriorityLabel, VerdictBadge, WorkflowBadge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/spinner";
import { formatDate, formatPercent } from "@/lib/format";
import { caseMatchesSearch } from "@/stores/cases";
import { PRIORITIES, type CaseSummary } from "@/types/case";

// Case list with the mobile filter set (filtercases.tsx): quick verdict filter,
// priority, sort, and free-text search across code, subject, examiner, type,
// date and verdict.

type Mode = "user" | "admin";
type SortKey = "Newest first" | "Oldest first" | "Suspected first" | "Genuine first";
const SORTS: SortKey[] = ["Newest first", "Oldest first", "Suspected first", "Genuine first"];

function verdictOptions(mode: Mode) {
  const values = mode === "admin" ? ["All", "Genuine", "Suspected", "Pending"] : ["All", "Genuine", "Suspected", "Processing"];
  return values.map((value) => ({ value, label: value }));
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
}) {
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState(initialVerdict);
  const [priority, setPriority] = useState("All");
  const [sort, setSort] = useState<SortKey>("Newest first");

  const visible = useMemo(() => {
    const filtered = cases.filter(
      (item) =>
        applyVerdict(item, verdict, mode) &&
        (priority === "All" || item.priority === priority) &&
        caseMatchesSearch(item, query, mode),
    );
    const sorted = sortCases(filtered, sort);
    return limit ? sorted.slice(0, limit) : sorted;
  }, [cases, limit, mode, priority, query, sort, verdict]);

  const filtersActive = Boolean(query.trim()) || verdict !== "All" || priority !== "All";

  return (
    <div>
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
            <select
              aria-label="Priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="h-10 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink-2 outline-none focus:border-brand"
            >
              <option value="All">All priorities</option>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-10 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink-2 outline-none focus:border-brand"
            >
              {SORTS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
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
                {mode === "admin" ? <th scope="col" className="px-3 py-2.5 font-semibold">Examiner</th> : null}
                <th scope="col" className="hidden px-3 py-2.5 font-semibold lg:table-cell">Document</th>
                <th scope="col" className="hidden px-3 py-2.5 font-semibold lg:table-cell">Priority</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Verdict</th>
                {mode === "admin" ? <th scope="col" className="hidden px-3 py-2.5 font-semibold xl:table-cell">Review</th> : null}
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Created</th>
                <th scope="col" className="w-10 pr-4"><span className="sr-only">Open</span></th>
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
                    <td className="w-full truncate text-ink-2 md:w-auto md:max-w-[220px] md:px-3">{item.subjectName || "—"}</td>
                    {mode === "admin" ? <td className="hidden truncate text-ink-2 md:table-cell md:max-w-[180px] md:px-3">{item.examiner || "—"}</td> : null}
                    <td className="hidden text-ink-2 lg:table-cell lg:px-3">
                      {item.documentType === "Other" && item.otherDocumentType ? item.otherDocumentType : item.documentType}
                    </td>
                    <td className="hidden lg:table-cell lg:px-3">
                      <PriorityLabel priority={item.priority} />
                    </td>
                    <td className="md:px-3">
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
                      <td className="hidden xl:table-cell xl:px-3">
                        <WorkflowBadge status={item.workflowStatus} />
                      </td>
                    ) : null}
                    <td className="ml-auto text-right text-ink-3 tabular md:px-3">{formatDate(item.createdAt)}</td>
                    <td className="hidden pr-4 text-ink-4 md:table-cell">
                      <ChevronRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {toolbar && visible.length > 0 ? (
        <p className="mt-3 text-[12.5px] text-ink-3 tabular">
          Showing {visible.length} of {cases.length} case{cases.length === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
