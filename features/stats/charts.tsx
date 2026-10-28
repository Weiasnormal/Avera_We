"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import type { Trend } from "./compute";

// Chart marks for case statistics. Identity is also carried by the legend,
// tooltip and table view, so color is never the only cue.
export const SERIES = {
  genuine: { label: "Genuine", color: "var(--color-chart-genuine)" },
  suspected: { label: "Suspected", color: "var(--color-chart-suspected)" },
} as const;

// Past periods recede so the current one carries the eye.
const PAST_OPACITY = 0.3;
const STAGGER_MS = 45;

export interface Bucket {
  label: string;
  genuine: number;
  suspected: number;
}

function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[3px]", className)} style={{ backgroundColor: color }} />;
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[12.5px] font-medium text-ink-2">
      {Object.values(SERIES).map((series) => (
        <span key={series.label} className="inline-flex items-center gap-1.5">
          <Swatch color={series.color} />
          {series.label}
        </span>
      ))}
    </div>
  );
}

/** Pill showing month-over-month change; green when volume grows. */
export function TrendBadge({ trend }: { trend: Trend }) {
  const tone =
    trend.kind === "up" || trend.kind === "new"
      ? "bg-genuine-soft text-genuine"
      : trend.kind === "down"
        ? "bg-suspect-soft text-suspect"
        : "bg-sunken text-ink-3";
  const Icon = trend.kind === "up" ? ArrowUpRight : trend.kind === "down" ? ArrowDownRight : null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-semibold tabular animate-fade-in", tone)}>
      {Icon ? <Icon aria-hidden className="size-3.5" strokeWidth={2.5} /> : null}
      {trend.label}
    </span>
  );
}

/** Stacked columns of genuine (bottom) and suspected (top) cases per period; the last period is highlighted. */
export function StackedColumns({ buckets, caption }: { buckets: Bucket[]; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.genuine + bucket.suspected));
  const current = buckets.length - 1;

  return (
    <figure>
      {asTable ? (
        <table className="w-full text-[13px] animate-fade-in">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-left text-[12px] text-ink-3">
            <tr className="border-b border-line">
              <th className="py-2 font-semibold">Period</th>
              <th className="py-2 text-right font-semibold">Genuine</th>
              <th className="py-2 text-right font-semibold">Suspected</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {buckets.map((bucket) => (
              <tr key={bucket.label} className="border-b border-line last:border-0">
                <td className="py-2 text-ink-2">{bucket.label}</td>
                <td className="py-2 text-right">{bucket.genuine}</td>
                <td className="py-2 text-right">{bucket.suspected}</td>
                <td className="py-2 text-right font-semibold">{bucket.genuine + bucket.suspected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div role="img" aria-label={caption} className="flex h-52 items-stretch gap-2.5 sm:gap-4">
          {buckets.map((bucket, index) => {
            const total = bucket.genuine + bucket.suspected;
            const emphasized = hover === null ? index === current : hover === index;
            return (
              <div
                key={bucket.label}
                className="relative flex min-w-0 flex-1 flex-col items-center"
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
              >
                <div className="flex w-full flex-1 flex-col justify-end">
                  <div
                    className="mx-auto flex w-full max-w-24 origin-bottom flex-col gap-0.75 transition-opacity duration-200 ease-out animate-[bar-grow_520ms_var(--ease-out)_both]"
                    style={{
                      height: total ? `${Math.max((total / max) * 100, 4)}%` : 0,
                      opacity: emphasized ? 1 : PAST_OPACITY,
                      animationDelay: `${index * STAGGER_MS}ms`,
                    }}
                  >
                    {bucket.suspected > 0 ? (
                      <div className="min-h-1 rounded-t-sm rounded-b-[3px]" style={{ flexGrow: bucket.suspected, backgroundColor: SERIES.suspected.color }} />
                    ) : null}
                    {bucket.genuine > 0 ? (
                      <div
                        className={cn("min-h-1 rounded-b-[3px]", bucket.suspected > 0 ? "rounded-t-[3px]" : "rounded-t-sm")}
                        style={{ flexGrow: bucket.genuine, backgroundColor: SERIES.genuine.color }}
                      />
                    ) : null}
                  </div>
                </div>
                <span
                  className={cn(
                    "mt-2.5 h-4 max-w-full truncate text-[12px] transition-colors duration-200",
                    emphasized ? "font-semibold text-ink-2" : "text-ink-4",
                  )}
                >
                  {bucket.label}
                </span>
                {hover === index ? (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-md border border-line bg-surface px-3 py-2 text-[12px] shadow-pop animate-rise-in">
                    <p className="mb-1 font-semibold text-ink">{bucket.label}</p>
                    <p className="flex items-center gap-1.5 text-ink-2 tabular">
                      <Swatch color={SERIES.genuine.color} className="size-2" /> Genuine {bucket.genuine}
                    </p>
                    <p className="flex items-center gap-1.5 text-ink-2 tabular">
                      <Swatch color={SERIES.suspected.color} className="size-2" /> Suspected {bucket.suspected}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Legend />
        <button
          type="button"
          onClick={() => setAsTable((value) => !value)}
          className="pressable rounded-sm text-[12.5px] font-semibold text-brand hover:underline"
        >
          {asTable ? "View as chart" : "View as table"}
        </button>
      </div>
    </figure>
  );
}

/** Horizontal bars for a single-series breakdown (cases by document type). */
export function BarList({ items, emptyLabel = "No data yet" }: { items: { label: string; count: number }[]; emptyLabel?: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  if (items.length === 0) return <p className="py-6 text-center text-[13px] text-ink-3">{emptyLabel}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={item.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-[13px]">
          <span className="truncate text-ink-2">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-sunken">
            <span
              className="block h-full rounded-full bg-brand transition-[width] duration-500 ease-out animate-[reveal-x_640ms_var(--ease-out)_both]"
              style={{ width: `${(item.count / max) * 100}%`, animationDelay: `${120 + index * STAGGER_MS}ms` }}
            />
          </span>
          <span className="text-right font-semibold text-ink tabular">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

/** Genuine / suspected share as a single proportion bar with labeled values. */
export function VerdictSplit({ genuine, suspected }: { genuine: number; suspected: number }) {
  const total = genuine + suspected;
  const genuinePct = total ? Math.round((genuine / total) * 100) : 0;
  return (
    <div>
      <div className="flex h-2.5 gap-0.75 overflow-hidden rounded-full bg-sunken animate-[reveal-x_720ms_var(--ease-out)_both] [animation-delay:80ms]">
        {genuine > 0 ? <span className="rounded-full" style={{ flexGrow: genuine, backgroundColor: SERIES.genuine.color }} /> : null}
        {suspected > 0 ? <span className="rounded-full" style={{ flexGrow: suspected, backgroundColor: SERIES.suspected.color }} /> : null}
      </div>
      <div className="mt-3 flex justify-between text-[13px]">
        <span className="flex items-center gap-1.5 text-ink-2">
          <Swatch color={SERIES.genuine.color} />
          Genuine <strong className="text-ink tabular">{genuine}</strong>
          <span className="text-ink-3 tabular">({total ? genuinePct : 0}%)</span>
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <Swatch color={SERIES.suspected.color} />
          Suspected <strong className="text-ink tabular">{suspected}</strong>
          <span className="text-ink-3 tabular">({total ? 100 - genuinePct : 0}%)</span>
        </span>
      </div>
    </div>
  );
}
