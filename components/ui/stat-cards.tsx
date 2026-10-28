import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Skeleton } from "./spinner";

export type StatTone = "brand" | "genuine" | "suspect" | "pending";

export interface StatCard {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: StatTone;
  /** Colors the number too (verdict counts); other figures stay ink. */
  toneValue?: boolean;
  loading?: boolean;
}

const TONE: Record<StatTone, string> = {
  brand: "text-brand",
  genuine: "text-genuine",
  suspect: "text-suspect",
  pending: "text-pending",
};

/**
 * Headline figures as separate cards: label, large number, and a large line icon
 * anchored to the bottom-right corner (cropped by the card edge).
 */
export function StatCards({ stats, className }: { stats: StatCard[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}>
      {stats.map(({ label, value, icon: Icon, tone, toneValue, loading }) => (
        <div
          key={label}
          className="relative isolate min-h-28 overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-card sm:min-h-32 sm:p-5"
        >
          <dt className="relative z-10 text-[12.5px] font-medium text-ink-3 sm:text-[13px]">{label}</dt>
          <dd
            className={cn(
              "relative z-10 mt-1 text-[26px] leading-tight font-bold tracking-[-0.02em] tabular sm:text-[30px]",
              toneValue ? TONE[tone] : "text-ink",
            )}
          >
            {loading ? <Skeleton className="mt-1.5 h-7 w-12" /> : value}
          </dd>
          <Icon
            aria-hidden
            strokeWidth={1.75}
            className={cn("absolute -right-1 -bottom-2 size-12 sm:size-14", TONE[tone])}
          />
        </div>
      ))}
    </dl>
  );
}
