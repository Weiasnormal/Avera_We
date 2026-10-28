"use client";

import { FolderOpen, LoaderCircle, CircleAlert, CircleCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, LoadError } from "@/components/feedback/states";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import { StatCards } from "@/components/ui/stat-cards";
import { BarList, ChartKindToggle, TrendChart, VerdictDonut, type ChartKind } from "@/features/stats/charts";
import { filterByRange, monthlyTrend, rangeLabel, rangeTrend, summarize, type TimeRange } from "@/features/stats/compute";
import { RangePicker } from "@/features/stats/range-picker";
import { useCases } from "@/hooks/use-cases";

const share = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}% of verdicts` : undefined);

/** Examiner statistics (mobile user_stats.tsx), on the same layout as the admin page. */
export function ExaminerStats() {
  const { cases, error, reload, isInitialLoading } = useCases();
  const [range, setRange] = useState<TimeRange>("This Year");
  const inRange = useMemo(() => filterByRange(cases, range), [cases, range]);
  const summary = useMemo(() => summarize(inRange), [inRange]);
  const trend = useMemo(() => rangeTrend(cases, range), [cases, range]);
  // Each range suggests a chart type; once the user picks one it sticks across ranges.
  const [chosenKind, setChosenKind] = useState<ChartKind | null>(null);
  const chartKind = chosenKind ?? trend.kind;
  const monthOverMonth = useMemo(() => monthlyTrend(cases), [cases]);
  const decided = summary.genuine + summary.suspected;

  if (error && cases.length === 0) return <LoadError message={error} onRetry={() => void reload()} />;

  return (
    <>
      <PageHeader
        title="Statistics"
        description={`Your analyses, ${rangeLabel(range).toLowerCase()}.`}
        actions={<RangePicker value={range} onChange={setRange} />}
      />

      <StatCards
        className="mb-5"
        stats={[
          { label: "Cases", value: summary.total, meta: monthOverMonth.label, icon: FolderOpen, tone: "brand", loading: isInitialLoading },
          { label: "Genuine", value: summary.genuine, meta: share(summary.genuine, decided), icon: CircleCheck, tone: "genuine", loading: isInitialLoading },
          { label: "Suspected", value: summary.suspected, meta: share(summary.suspected, decided), icon: CircleAlert, tone: "suspect", loading: isInitialLoading },
          { label: "Processing", value: summary.processing, icon: LoaderCircle, tone: "brand", loading: isInitialLoading },
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
          <EmptyState illustration="/illustrations/emptydash.webp" title="No statistics yet" description="Statistics appear once you have analyzed cases." />
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
        </div>
      )}
    </>
  );
}
