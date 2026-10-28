"use client";

import { ChartColumn, ChartLine } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Segmented } from "@/components/ui/controls";
import { cn } from "@/lib/cn";

// Chart marks for case statistics. Identity is also carried by the legend,
// tooltip and table view, so color is never the only cue.
export const SERIES = {
  genuine: { label: "Genuine", color: "var(--color-chart-genuine)" },
  suspected: { label: "Suspected", color: "var(--color-chart-suspected)" },
} as const;

// Past periods recede so the current one carries the eye.
const PAST_OPACITY = 0.3;
const STAGGER_MS = 45;
const TICKS = 4;

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

/**
 * Axis scale with gridlines on readable steps (1, 2, 5 × 10ⁿ). The top is the
 * first step at or above the peak, so a peak of 30 tops out at 30, not 40.
 */
function niceScale(max: number) {
  const rough = Math.max(1, max) / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rough) ?? rough);
  const count = Math.max(2, Math.ceil(Math.max(1, max) / step));
  return { top: step * count, count };
}

export type ChartKind = "columns" | "lines";

const KIND_OPTIONS = [
  {
    value: "columns" as const,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <ChartColumn aria-hidden className="size-3.5" />
        Bar
      </span>
    ),
  },
  {
    value: "lines" as const,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <ChartLine aria-hidden className="size-3.5" />
        Line
      </span>
    ),
  },
];

/** Bar / line switch for a trend panel header. */
export function ChartKindToggle({ value, onChange }: { value: ChartKind; onChange: (value: ChartKind) => void }) {
  return <Segmented label="Chart type" size="sm" value={value} onChange={onChange} options={KIND_OPTIONS} />;
}

function Tooltip({ bucket }: { bucket: Bucket }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-[12px] shadow-pop animate-rise-in">
      <p className="mb-1 font-semibold text-ink">{bucket.label}</p>
      <p className="flex items-center gap-1.5 text-ink-2 tabular">
        <Swatch color={SERIES.genuine.color} className="size-2" /> Genuine {bucket.genuine}
      </p>
      <p className="flex items-center gap-1.5 text-ink-2 tabular">
        <Swatch color={SERIES.suspected.color} className="size-2" /> Suspected {bucket.suspected}
      </p>
    </div>
  );
}

function TableView({ buckets, caption }: { buckets: Bucket[]; caption: string }) {
  return (
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
  );
}

/**
 * Genuine and suspected cases per period on a shared y-axis. Columns (stacked)
 * suit a handful of months; lines suit many short periods (days, weeks).
 */
export function TrendChart({ buckets, caption, kind = "columns" }: { buckets: Bucket[]; caption: string; kind?: ChartKind }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const peak = Math.max(
    0,
    ...buckets.map((bucket) => (kind === "columns" ? bucket.genuine + bucket.suspected : Math.max(bucket.genuine, bucket.suspected))),
  );
  const { top, count } = niceScale(peak);
  const ticks = Array.from({ length: count + 1 }, (_, index) => (top / count) * (count - index));
  const current = buckets.length - 1;

  return (
    <figure>
      {asTable ? (
        <TableView buckets={buckets} caption={caption} />
      ) : (
        // Keyed by kind so switching bar/line cross-fades instead of snapping.
        <div key={kind} role="img" aria-label={caption} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 animate-fade-in">
          {/* Y axis: labels sit on their gridlines. */}
          <div className="relative h-56 text-right text-[11.5px] text-ink-4 tabular">
            {ticks.map((value, index) => (
              <span key={value} className="absolute right-0 -translate-y-1/2" style={{ top: `${(index / count) * 100}%` }}>
                {value}
              </span>
            ))}
          </div>
          <div className="relative h-56">
            {ticks.map((value, index) => (
              <span
                key={value}
                aria-hidden
                className={cn("absolute inset-x-0 border-t", index === count ? "border-line-strong" : "border-dashed border-line")}
                style={{ top: `${(index / count) * 100}%` }}
              />
            ))}
            {/* Remounts when the periods change, so the lines redraw for the new range. */}
            {kind === "lines" ? <Lines key={buckets.map((bucket) => bucket.label).join()} buckets={buckets} top={top} /> : null}
            <div className="absolute inset-0 flex">
              {buckets.map((bucket, index) => {
                const emphasized = hover === null ? index === current : hover === index;
                return (
                  <div
                    key={bucket.label}
                    className="relative flex min-w-0 flex-1 flex-col items-center justify-end"
                    onPointerEnter={() => setHover(index)}
                    onPointerLeave={() => setHover(null)}
                  >
                    {kind === "columns" ? (
                      <Column bucket={bucket} top={top} emphasized={emphasized} index={index} />
                    ) : (
                      <>
                        <span aria-hidden className={cn("absolute inset-y-0 w-px transition-colors", hover === index ? "bg-line-strong" : "bg-transparent")} />
                        <Dot value={bucket.suspected} top={top} color={SERIES.suspected.color} emphasized={emphasized} />
                        <Dot value={bucket.genuine} top={top} color={SERIES.genuine.color} emphasized={emphasized} />
                      </>
                    )}
                    {hover === index ? (
                      <div className="absolute inset-x-0" style={{ bottom: `${(peakOf(bucket, kind) / top) * 100}%` }}>
                        <Tooltip bucket={bucket} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          {/* X axis labels; long runs show every other label so they never collide. */}
          <div />
          <div className="mt-2.5 flex">
            {buckets.map((bucket, index) => {
              const emphasized = hover === null ? index === current : hover === index;
              const skip = buckets.length > 12 && (current - index) % 2 === 1 && hover !== index;
              return (
                <span
                  key={bucket.label}
                  className={cn(
                    "h-4 min-w-0 flex-1 truncate text-center text-[11.5px] transition-colors duration-200",
                    emphasized ? "font-semibold text-ink-2" : "text-ink-4",
                    skip && "invisible",
                  )}
                >
                  {bucket.label}
                </span>
              );
            })}
          </div>
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

function peakOf(bucket: Bucket, kind: ChartKind) {
  return kind === "columns" ? bucket.genuine + bucket.suspected : Math.max(bucket.genuine, bucket.suspected);
}

function Column({ bucket, top, emphasized, index }: { bucket: Bucket; top: number; emphasized: boolean; index: number }) {
  const total = bucket.genuine + bucket.suspected;
  return (
    <div
      className="flex w-full max-w-10 origin-bottom flex-col gap-0.5 transition-[height,opacity] duration-300 ease-[var(--ease-out)] animate-[bar-grow_520ms_var(--ease-out)_both]"
      style={{ height: `${(total / top) * 100}%`, opacity: emphasized ? 1 : PAST_OPACITY, animationDelay: `${index * STAGGER_MS}ms` }}
    >
      {bucket.suspected > 0 ? (
        <div className="min-h-1 rounded-t-[5px] rounded-b-[2px]" style={{ flexGrow: bucket.suspected, backgroundColor: SERIES.suspected.color }} />
      ) : null}
      {bucket.genuine > 0 ? (
        <div
          className={cn("min-h-1 rounded-b-[2px]", bucket.suspected > 0 ? "rounded-t-[2px]" : "rounded-t-[5px]")}
          style={{ flexGrow: bucket.genuine, backgroundColor: SERIES.genuine.color }}
        />
      ) : null}
    </div>
  );
}

function Dot({ value, top, color, emphasized }: { value: number; top: number; color: string; emphasized: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("absolute left-1/2 rounded-full border-2 border-surface", emphasized ? "size-3" : "size-2.5")}
      style={{ bottom: `${(value / top) * 100}%`, backgroundColor: color, transform: "translate(-50%, 50%)" }}
    />
  );
}

/** One polyline per series through the center of each period. Strokes stay 2px however the plot stretches. */
function Lines({ buckets, top }: { buckets: Bucket[]; top: number }) {
  const point = (value: number, index: number) => `${((index + 0.5) / buckets.length) * 100},${100 - (value / top) * 100}`;
  return (
    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible animate-[reveal-x_720ms_var(--ease-out)_both]">
      {(["genuine", "suspected"] as const).map((key) => (
        <polyline
          key={key}
          points={buckets.map((bucket, index) => point(bucket[key], index)).join(" ")}
          fill="none"
          stroke={SERIES[key].color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
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

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

/** Genuine / suspected share of decided cases as a donut, total in the middle. */
export function VerdictDonut({ genuine, suspected, footer }: { genuine: number; suspected: number; footer?: ReactNode }) {
  const total = genuine + suspected;
  const genuinePct = total ? Math.round((genuine / total) * 100) : 0;
  const segments = [
    { key: "genuine", value: genuine, color: SERIES.genuine.color, offset: 0 },
    { key: "suspected", value: suspected, color: SERIES.suspected.color, offset: total ? (genuine / total) * CIRCUMFERENCE : 0 },
  ].filter((segment) => segment.value > 0);
  const gap = segments.length > 1 ? GAP : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
      <div className="relative size-34 shrink-0">
        <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
          <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="var(--color-sunken)" strokeWidth="14" />
          {segments.map((segment) => (
            <circle
              key={segment.key}
              cx="64"
              cy="64"
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth="14"
              strokeDasharray={`${Math.max(0, (segment.value / total) * CIRCUMFERENCE - gap)} ${CIRCUMFERENCE}`}
              strokeDashoffset={-segment.offset}
              className="animate-fade-in"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] leading-none font-bold text-ink tabular">{total}</span>
          <span className="mt-1 text-[11.5px] text-ink-3">{total === 1 ? "verdict" : "verdicts"}</span>
        </div>
      </div>
      <dl className="min-w-44 flex-1 text-[13px]">
        {[
          { label: "Genuine", value: genuine, pct: genuinePct, color: SERIES.genuine.color },
          { label: "Suspected", value: suspected, pct: total ? 100 - genuinePct : 0, color: SERIES.suspected.color },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
            <Swatch color={row.color} />
            <dt className="flex-1 text-ink-2">{row.label}</dt>
            <dd className="font-semibold text-ink tabular">{row.value}</dd>
            <dd className="w-10 text-right text-ink-3 tabular">{row.pct}%</dd>
          </div>
        ))}
        {footer ? <div className="pt-2.5 text-[12.5px] text-ink-3">{footer}</div> : null}
      </dl>
    </div>
  );
}
