import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Skeleton } from "./spinner";

// Mirrors the mobile StatCard (admin_dashboard / admin_stats): label, one line of
// context, the number, and a large stroke-2 Lucide icon cropped by the corner.
// Icon colors match mobile: primary blue for counts, green/red for verdicts,
// amber for work waiting on a reviewer.
export type StatTone = "brand" | "genuine" | "suspect" | "pending";

export interface StatCard {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: StatTone;
  /** One line of context under the label ("7 of 10 seats used"). */
  meta?: ReactNode;
  /** Opens a filtered view; the whole card becomes the link. */
  href?: string;
  /** The one figure a role acts on; tinted so it reads first. */
  hero?: boolean;
  /** Quota meter (e.g. cases created today out of the daily limit). */
  progress?: { value: number; max: number };
  loading?: boolean;
}

const GLYPH: Record<StatTone, string> = {
  brand: "text-brand",
  genuine: "text-chart-genuine",
  suspect: "text-chart-suspected",
  pending: "text-pending",
};

/** Headline figures as separate cards. Cards with an href are shortcuts into the matching filtered list. */
export function StatCards({ stats, className }: { stats: StatCard[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5", className)}>
      {stats.map((stat) => (
        <StatItem key={stat.label} {...stat} />
      ))}
    </dl>
  );
}

function StatItem({ label, value, icon: Icon, tone, meta, href, hero, progress, loading }: StatCard) {
  return (
    <div
      className={cn(
        "group relative isolate min-h-34 overflow-hidden rounded-xl border p-4 shadow-card sm:min-h-38 sm:p-5",
        hero ? "border-pending-line bg-pending-soft" : "border-line bg-surface",
        href &&
          "pressable has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand hover:-translate-y-px hover:shadow-pop",
        href && (hero ? "hover:border-pending/50" : "hover:border-line-strong"),
      )}
    >
      <dt className={cn("pr-6 text-[13px] font-semibold sm:text-[13.5px]", hero ? "text-pending-ink" : "text-ink-3")}>
        {href ? (
          // The link covers the whole card; the card shows the focus ring instead.
          <Link href={href} className="after:absolute after:inset-0 after:z-20 focus-visible:outline-none">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className={cn("relative z-10 mt-0.5 h-4.5 max-w-[78%] truncate text-[12.5px]", hero ? "text-pending-ink/80" : "text-ink-3")}>
        {loading ? null : meta}
      </dd>
      <dd
        className={cn(
          "relative z-10 mt-2 text-[30px] leading-none font-bold tracking-[-0.025em] tabular sm:text-[38px]",
          hero ? "text-pending-ink" : "text-ink",
        )}
      >
        {loading ? <Skeleton className="h-8 w-14" /> : value}
      </dd>
      {progress && !loading ? (
        <dd className="relative z-10 mt-4 h-1.5 w-[62%] overflow-hidden rounded-full bg-sunken">
          <span
            className="block h-full rounded-full bg-brand animate-[reveal-x_640ms_var(--ease-out)_both]"
            style={{ width: `${Math.min(100, (progress.value / Math.max(1, progress.max)) * 100)}%` }}
          />
        </dd>
      ) : null}
      {href ? (
        <ArrowUpRight
          aria-hidden
          className="absolute top-4 right-4 z-10 size-4 -translate-x-0.5 text-ink-4 opacity-0 transition-[opacity,transform] duration-200 ease-[var(--ease-out)] group-hover:translate-x-0 group-hover:opacity-100 sm:top-5 sm:right-5"
        />
      ) : null}
      <Icon
        aria-hidden
        strokeWidth={2}
        className={cn(
          "absolute -right-1 -bottom-3 size-15 transition-transform duration-300 ease-[var(--ease-out)] sm:size-19",
          href && "group-hover:-translate-y-0.5",
          GLYPH[tone],
        )}
      />
    </div>
  );
}
