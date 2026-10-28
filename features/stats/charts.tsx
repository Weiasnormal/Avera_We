"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

// Chart marks for case statistics. Genuine / Suspected colors are lightness-
// separated (validated: CVD ΔE 14.2) so the pair survives color-vision
// deficiency; identity is also carried by the legend and table view.
export const SERIES = {
  genuine: { label: "Genuine", color: "#1e7a4c" },
  suspected: { label: "Suspected", color: "#ec8a86" },
} as const;

export interface Bucket {
  label: string;
  genuine: number;
  suspected: number;
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[12.5px] text-ink-2">
      {Object.values(SERIES).map((series) => (
        <span key={series.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ backgroundColor: series.color }} />
          {series.label}
        </span>
      ))}
    </div>
  );
}

/** Stacked columns of genuine (bottom) and suspected (top) cases per period. */
export function StackedColumns({ buckets, caption }: { buckets: Bucket[]; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.genuine + bucket.suspected));
  const ticks = [max, Math.round(max / 2), 0].filter((value, index, all) => all.indexOf(value) === index);

  return (
    <figure>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Legend />
        <button type="button" onClick={() => setAsTable((value) => !value)} className="text-[12.5px] font-semibold text-brand hover:underline">
          {asTable ? "View as chart" : "View as table"}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-[13px]">
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
        <div className="relative flex gap-3">
          <div aria-hidden className="flex h-48 flex-col justify-between pb-6 text-right text-[11px] text-ink-4 tabular">
            {ticks.map((tick) => (
              <span key={tick} className="-translate-y-1/2 leading-none">
                {tick}
              </span>
            ))}
          </div>
          <div className="relative flex-1">
            <div aria-hidden className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
              {ticks.map((tick) => (
                <span key={tick} className={cn("h-px", tick === 0 ? "bg-line-strong" : "bg-line")} />
              ))}
            </div>
            <div role="img" aria-label={caption} className="relative flex h-48 items-stretch gap-2 sm:gap-3">
              {buckets.map((bucket, index) => {
                const total = bucket.genuine + bucket.suspected;
                const active = hover === index;
                return (
                  <div
                    key={bucket.label}
                    className="group relative flex flex-1 flex-col items-center"
                    onPointerEnter={() => setHover(index)}
                    onPointerLeave={() => setHover(null)}
                  >
                    <div className="flex w-full flex-1 flex-col justify-end pb-px">
                      <div className="mx-auto flex w-full max-w-10 flex-col gap-0.5" style={{ height: `${(total / max) * 100}%` }}>
                        {bucket.suspected > 0 ? (
                          <div
                            className="rounded-t-[4px]"
                            style={{ flexGrow: bucket.suspected, backgroundColor: SERIES.suspected.color, opacity: hover === null || active ? 1 : 0.55 }}
                          />
                        ) : null}
                        {bucket.genuine > 0 ? (
                          <div
                            className={cn(bucket.suspected > 0 ? "" : "rounded-t-[4px]")}
                            style={{ flexGrow: bucket.genuine, backgroundColor: SERIES.genuine.color, opacity: hover === null || active ? 1 : 0.55 }}
                          />
                        ) : null}
                      </div>
                    </div>
                    <span className="mt-2 h-4 truncate text-[11.5px] text-ink-3">{bucket.label}</span>
                    {active ? (
                      <div className="pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-md border border-line bg-surface px-3 py-2 text-[12px] shadow-pop animate-fade-in">
                        <p className="mb-1 font-semibold text-ink">{bucket.label}</p>
                        <p className="flex items-center gap-1.5 text-ink-2 tabular">
                          <span className="size-2 rounded-xs" style={{ backgroundColor: SERIES.genuine.color }} /> Genuine {bucket.genuine}
                        </p>
                        <p className="flex items-center gap-1.5 text-ink-2 tabular">
                          <span className="size-2 rounded-xs" style={{ backgroundColor: SERIES.suspected.color }} /> Suspected {bucket.suspected}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars for a single-series breakdown (cases by document type). */
export function BarList({ items, emptyLabel = "No data yet" }: { items: { label: string; count: number }[]; emptyLabel?: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  if (items.length === 0) return <p className="py-6 text-center text-[13px] text-ink-3">{emptyLabel}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-[13px]">
          <span className="truncate text-ink-2">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-sunken">
            <span
              className="block h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
              style={{ width: `${(item.count / max) * 100}%` }}
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
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-sunken">
        {genuine > 0 ? <span style={{ flexGrow: genuine, backgroundColor: SERIES.genuine.color }} /> : null}
        {suspected > 0 ? <span style={{ flexGrow: suspected, backgroundColor: SERIES.suspected.color }} /> : null}
      </div>
      <div className="mt-3 flex justify-between text-[13px]">
        <span className="flex items-center gap-1.5 text-ink-2">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ backgroundColor: SERIES.genuine.color }} />
          Genuine <strong className="text-ink tabular">{genuine}</strong>
          <span className="text-ink-3 tabular">({total ? genuinePct : 0}%)</span>
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ backgroundColor: SERIES.suspected.color }} />
          Suspected <strong className="text-ink tabular">{suspected}</strong>
          <span className="text-ink-3 tabular">({total ? 100 - genuinePct : 0}%)</span>
        </span>
      </div>
    </div>
  );
}
