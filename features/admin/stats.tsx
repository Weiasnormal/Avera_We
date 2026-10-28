"use client";

import { CalendarRange, ClipboardClock, FolderOpen, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, LoadError } from "@/components/feedback/states";
import { Avatar } from "@/components/ui/avatar";
import { Segmented } from "@/components/ui/controls";
import { PageHeader, Panel } from "@/components/ui/panel";
import { StatCards } from "@/components/ui/stat-cards";
import { BarList, StackedColumns, VerdictSplit } from "@/features/stats/charts";
import {
  GRANULARITIES,
  TIME_RANGES,
  filterByRange,
  summarize,
  trendBuckets,
  type Granularity,
  type TimeRange,
} from "@/features/stats/compute";
import { useCases } from "@/hooks/use-cases";
import { routes } from "@/lib/routes";
import { useAdminStore } from "@/stores/admin";

/** Organization statistics (mobile admin_stats.tsx). */
export function AdminStats() {
  const { cases, error, reload, isInitialLoading } = useCases();
  const members = useAdminStore((state) => state.members);
  const [range, setRange] = useState<TimeRange>("This Year");
  const [granularity, setGranularity] = useState<Granularity>("Weekly");

  useEffect(() => {
    void useAdminStore.getState().loadTeam();
  }, []);

  const inRange = useMemo(() => filterByRange(cases, range), [cases, range]);
  const summary = useMemo(() => summarize(inRange), [inRange]);
  const buckets = useMemo(() => trendBuckets(cases, granularity), [cases, granularity]);
  const [now] = useState(() => Date.now());
  const casesThisWeek = useMemo(() => {
    const weekAgo = now - 7 * 86_400_000;
    return cases.filter((item) => new Date(item.createdAt).getTime() >= weekAgo).length;
  }, [cases, now]);
  const active = members.filter((member) => member.status === "active");
  const ranked = [...active].sort((a, b) => b.casesHandled - a.casesHandled);

  if (error && cases.length === 0) return <LoadError message={error} onRetry={() => void reload()} />;

  return (
    <>
      <PageHeader
        title="Statistics"
        description="Organization-wide case volume and outcomes."
        actions={
          <select
            aria-label="Time range"
            value={range}
            onChange={(event) => setRange(event.target.value as TimeRange)}
            className="h-10 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink outline-none focus:border-brand"
          >
            {TIME_RANGES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        }
      />

      <StatCards
        className="mb-6"
        stats={[
          { label: `Cases · ${range.toLowerCase()}`, value: summary.total, icon: FolderOpen, tone: "brand", loading: isInitialLoading },
          { label: "Cases in the last 7 days", value: casesThisWeek, icon: CalendarRange, tone: "brand", loading: isInitialLoading },
          { label: "Awaiting review", value: summary.pendingReview, icon: ClipboardClock, tone: "pending", loading: isInitialLoading },
          { label: "Active examiners", value: `${active.length} / ${members.length}`, icon: Users, tone: "brand", loading: isInitialLoading },
        ]}
      />

      {!isInitialLoading && cases.length === 0 ? (
        <Panel>
          <EmptyState illustration="/illustrations/emptydash.webp" title="No statistics yet" description="Statistics appear once your examiners analyze cases." />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel
            title="Case trend"
            actions={
              <Segmented
                label="Granularity"
                size="sm"
                value={granularity}
                onChange={setGranularity}
                options={GRANULARITIES.map((value) => ({ value, label: value }))}
              />
            }
          >
            <StackedColumns buckets={buckets} caption={`Genuine and suspected cases, ${granularity.toLowerCase()}`} />
          </Panel>
          <div className="flex flex-col gap-6">
            <Panel title="Verdicts" description={range}>
              <VerdictSplit genuine={summary.genuine} suspected={summary.suspected} />
            </Panel>
            <Panel title="Document types" description={range}>
              <BarList items={summary.documentTypes} emptyLabel="No cases in this range" />
            </Panel>
          </div>
          <Panel title="Examiners by cases handled" className="lg:col-span-2" bodyClassName="p-0">
            {ranked.length === 0 ? (
              <EmptyState compact title="No active examiners" />
            ) : (
              <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                {ranked.map((member, index) => (
                  <li key={member.id} className="border-line sm:border-b sm:odd:border-r">
                    <Link href={routes.admin.member(member.id)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas">
                      <span className="w-5 text-[12px] font-semibold text-ink-4 tabular">{index + 1}</span>
                      <Avatar firstName={member.firstName} lastName={member.lastName} size={30} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                        {member.firstName} {member.lastName}
                      </span>
                      <span className="text-[13px] text-ink-2 tabular">{member.casesHandled}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
