"use client";

import { useMemo } from "react";

import { EmptyState, LoadError } from "@/components/feedback/states";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import { BarList, StackedColumns, TrendBadge, VerdictSplit } from "@/features/stats/charts";
import { monthlyBuckets, monthlyTrend, summarize } from "@/features/stats/compute";
import { useCases } from "@/hooks/use-cases";

/** Examiner statistics (mobile user_stats.tsx). */
export function ExaminerStats() {
  const { cases, error, reload, isInitialLoading } = useCases();
  const summary = useMemo(() => summarize(cases), [cases]);
  const buckets = useMemo(() => monthlyBuckets(cases), [cases]);
  const trend = useMemo(() => monthlyTrend(cases), [cases]);

  if (error && cases.length === 0) return <LoadError message={error} onRetry={() => void reload()} />;

  return (
    <>
      <PageHeader title="Statistics" description="Your analyses at a glance." />
      {isInitialLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : summary.total === 0 ? (
        <Panel>
          <EmptyState illustration="/illustrations/emptydash.webp" title="No statistics yet" description="Statistics appear once you have analyzed cases." />
        </Panel>
      ) : (
        <div className="stagger-in grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel title="Cases over time" actions={<TrendBadge trend={trend} />}>
            <StackedColumns buckets={buckets} caption="Genuine and suspected cases for the last six months" />
          </Panel>
          <div className="stagger-in flex flex-col gap-6">
            <Panel title="Verdicts" description={`${summary.total} cases · ${summary.processing} processing`}>
              <VerdictSplit genuine={summary.genuine} suspected={summary.suspected} />
            </Panel>
            <Panel title="Document types">
              <BarList items={summary.documentTypes} />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
