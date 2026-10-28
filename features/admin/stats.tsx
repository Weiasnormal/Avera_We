"use client";

import { FolderOpen, CircleAlert, CircleCheck, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, LoadError } from "@/components/feedback/states";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import { StatCards } from "@/components/ui/stat-cards";
import { BarList, ChartKindToggle, TrendChart, VerdictDonut, type ChartKind } from "@/features/stats/charts";
import { filterByRange, rangeLabel, rangeTrend, summarize, type TimeRange } from "@/features/stats/compute";
import { RangePicker } from "@/features/stats/range-picker";
import { useCases } from "@/hooks/use-cases";
import { routes } from "@/lib/routes";
import { useAdminStore } from "@/stores/admin";

const share = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}% of verdicts` : undefined);

/** Organization statistics (mobile admin_stats.tsx): the same four figures, one range for every panel. */
export function AdminStats() {
  const { cases, error, reload, isInitialLoading } = useCases();
  const members = useAdminStore((state) => state.members);
  const tenant = useAdminStore((state) => state.tenant);
  const teamLoading = useAdminStore((state) => state.teamStatus === "idle" || state.teamStatus === "loading");
  const [range, setRange] = useState<TimeRange>("This Year");

  useEffect(() => {
    void useAdminStore.getState().loadTenant();
    void useAdminStore.getState().loadTeam();
  }, []);

  const inRange = useMemo(() => filterByRange(cases, range), [cases, range]);
  const summary = useMemo(() => summarize(inRange), [inRange]);
  const trend = useMemo(() => rangeTrend(cases, range), [cases, range]);
  // Each range suggests a chart type; once the user picks one it sticks across ranges.
  const [chosenKind, setChosenKind] = useState<ChartKind | null>(null);
  const chartKind = chosenKind ?? trend.kind;
  const [now] = useState(() => Date.now());
  const casesThisWeek = useMemo(() => {
    const weekAgo = now - 7 * 86_400_000;
    return cases.filter((item) => new Date(item.createdAt).getTime() >= weekAgo).length;
  }, [cases, now]);
  const active = members.filter((member) => member.status === "active");
  const ranked = [...active].sort((a, b) => b.casesHandled - a.casesHandled);
  const decided = summary.genuine + summary.suspected;

  if (error && cases.length === 0) return <LoadError message={error} onRetry={() => void reload()} />;

  return (
    <>
      <PageHeader
        title="Statistics"
        description={`Organization-wide volume and outcomes, ${rangeLabel(range).toLowerCase()}.`}
        actions={<RangePicker value={range} onChange={setRange} />}
      />

      <StatCards
        className="mb-5"
        stats={[
          {
            label: "Active examiners",
            value: active.length,
            meta:
              tenant && tenant.memberCountLimit > 0
                ? `${tenant.memberCount} of ${tenant.memberCountLimit} seats used`
                : `${active.length} of ${members.length} examiners`,
            icon: Users,
            tone: "brand",
            loading: teamLoading && members.length === 0,
          },
          { label: "Total cases", value: summary.total, meta: `${casesThisWeek} this week`, icon: FolderOpen, tone: "brand", loading: isInitialLoading },
          { label: "Genuine", value: summary.genuine, meta: share(summary.genuine, decided), icon: CircleCheck, tone: "genuine", loading: isInitialLoading },
          { label: "Suspected", value: summary.suspected, meta: share(summary.suspected, decided), icon: CircleAlert, tone: "suspect", loading: isInitialLoading },
        ]}
      />

      {isInitialLoading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-lg lg:col-span-2" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : cases.length === 0 ? (
        <Panel>
          <EmptyState illustration="/illustrations/emptydash.webp" title="No statistics yet" description="Statistics appear once your examiners analyze cases." />
        </Panel>
      ) : (
        // Two equal columns so panel edges line up with the cards above.
        <div className="stagger-in grid gap-5 lg:grid-cols-2">
          <Panel
            title="Cases over time"
            description={trend.caption}
            className="lg:col-span-2"
            actions={<ChartKindToggle value={chartKind} onChange={setChosenKind} />}
          >
            <TrendChart buckets={trend.buckets} kind={chartKind} caption={trend.caption} />
          </Panel>
          <Panel title="Verdicts" description={`${decided} decided${summary.processing ? ` · ${summary.processing} processing` : ""}`}>
            <VerdictDonut genuine={summary.genuine} suspected={summary.suspected} />
          </Panel>
          <Panel title="Document types">
            <BarList items={summary.documentTypes} emptyLabel="No cases in this range" />
          </Panel>
          <Panel
            title="Top examiners"
            description="By cases handled"
            className="lg:col-span-2"
            bodyClassName="p-0"
            actions={
              <Link href={routes.admin.team} className="text-[13px] font-semibold text-brand hover:underline">
                Manage team
              </Link>
            }
          >
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
                      <span className="text-[13px] text-ink-2 tabular">
                        <strong className="font-semibold text-ink">{member.casesHandled}</strong> case{member.casesHandled === 1 ? "" : "s"}
                      </span>
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
