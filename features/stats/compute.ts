import type { CaseSummary } from "@/types/case";

import type { Bucket } from "./charts";

// Statistics derived from the case list, as the mobile user_stats / admin_stats
// screens compute them client-side.

export function summarize(cases: CaseSummary[]) {
  const counts: Record<string, number> = {};
  let genuine = 0;
  let suspected = 0;
  let processing = 0;
  let pendingReview = 0;
  for (const item of cases) {
    if (item.status === "Genuine") genuine += 1;
    if (item.status === "Suspected") suspected += 1;
    if (item.workflowStatus === "Processing") processing += 1;
    if (item.workflowStatus === "PendingReview") pendingReview += 1;
    const type = item.documentType === "Other" && item.otherDocumentType ? item.otherDocumentType : item.documentType;
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return {
    total: cases.length,
    genuine,
    suspected,
    processing,
    pendingReview,
    documentTypes: Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count })),
  };
}

/** Last six calendar months (mobile user_stats monthlyBars). */
export function monthlyBuckets(cases: CaseSummary[], months = 6): Bucket[] {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    return { label: date.toLocaleDateString("en-US", { month: "short" }), year: date.getFullYear(), month: date.getMonth(), genuine: 0, suspected: 0 };
  });
  for (const item of cases) {
    const created = new Date(item.createdAt);
    const bucket = buckets.find((entry) => entry.year === created.getFullYear() && entry.month === created.getMonth());
    if (!bucket) continue;
    if (item.status === "Genuine") bucket.genuine += 1;
    if (item.status === "Suspected") bucket.suspected += 1;
  }
  return buckets.map(({ label, genuine, suspected }) => ({ label, genuine, suspected }));
}

export type Trend =
  | { kind: "up" | "down"; percent: number; label: string }
  | { kind: "new" | "flat"; label: string };

/** Month-over-month change in case count (mobile monthlyTrendLabel). */
export function monthlyTrend(cases: CaseSummary[]): Trend {
  const now = new Date();
  const countFor = (offset: number) => {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return cases.filter((item) => {
      const created = new Date(item.createdAt);
      return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth();
    }).length;
  };
  const current = countFor(0);
  const previous = countFor(1);
  if (previous === 0) {
    return current > 0 ? { kind: "new", label: "New this month" } : { kind: "flat", label: "No change from last month" };
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return { kind: "flat", label: "No change from last month" };
  return { kind: change > 0 ? "up" : "down", percent: Math.abs(change), label: `${Math.abs(change)}% vs last month` };
}

// --- Admin time ranges (mobile admin_stats) ---------------------------------

export const TIME_RANGES = ["Today", "This Week", "This Month", "This Quarter", "This Year"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];
export const GRANULARITIES = ["Hourly", "Daily", "Weekly", "Monthly"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** First moment counted by a time range. */
function rangeStart(range: TimeRange, now = new Date()) {
  switch (range) {
    case "Today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "This Week":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    case "This Month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "This Quarter":
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    default:
      return new Date(now.getFullYear(), 0, 1);
  }
}

export function filterByRange(cases: CaseSummary[], range: TimeRange) {
  const start = rangeStart(range);
  return cases.filter((item) => new Date(item.createdAt) >= start);
}

export function trendBuckets(cases: CaseSummary[], granularity: Granularity, periods?: number): Bucket[] {
  if (granularity === "Monthly") return monthlyBuckets(cases, periods);
  const config = { Hourly: { count: 6, hours: 4 }, Daily: { count: 7, hours: 24 }, Weekly: { count: 5, hours: 24 * 7 } }[granularity];
  if (periods) config.count = periods;
  const stepMs = config.hours * 3_600_000;
  const now = Date.now();
  const buckets = Array.from({ length: config.count }, (_, index) => {
    const end = now - (config.count - 1 - index) * stepMs;
    const start = end - stepMs + 1000;
    const endDate = new Date(end);
    const label =
      granularity === "Hourly"
        ? endDate.toLocaleTimeString("en-US", { hour: "numeric" })
        : granularity === "Daily"
          ? endDate.toLocaleDateString("en-US", { weekday: "short" })
          : endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { label, start, end, genuine: 0, suspected: 0 };
  });
  for (const item of cases) {
    const created = new Date(item.createdAt).getTime();
    const bucket = buckets.find((entry) => created >= entry.start && created <= entry.end);
    if (!bucket) continue;
    if (item.status === "Genuine") bucket.genuine += 1;
    if (item.status === "Suspected") bucket.suspected += 1;
  }
  return buckets.map(({ label, genuine, suspected }) => ({ label, genuine, suspected }));
}

/** "This Week" → "This week" for controls (sentence case). */
export const rangeLabel = (range: TimeRange) => range.charAt(0) + range.slice(1).toLowerCase();

/**
 * Trend for a time range: the range picks the period size, so one control drives
 * every panel. Months read best as columns; shorter periods as lines.
 */
export function rangeTrend(cases: CaseSummary[], range: TimeRange): { buckets: Bucket[]; kind: "columns" | "lines"; caption: string } {
  const now = new Date();
  // Weekly views cover exactly the weeks inside the range, so the chart agrees with the cards.
  const weeksSoFar = Math.max(2, Math.ceil((now.getTime() - rangeStart(range, now).getTime()) / (7 * 86_400_000)));
  switch (range) {
    case "Today":
      return { buckets: trendBuckets(cases, "Hourly"), kind: "lines", caption: "Genuine and suspected cases, every 4 hours" };
    case "This Week":
      return { buckets: trendBuckets(cases, "Daily"), kind: "lines", caption: "Genuine and suspected cases per day" };
    case "This Month":
    case "This Quarter":
      return { buckets: trendBuckets(cases, "Weekly", weeksSoFar), kind: "lines", caption: "Genuine and suspected cases per week" };
    default:
      return {
        buckets: monthlyBuckets(cases, now.getMonth() + 1),
        kind: "columns",
        caption: "Genuine and suspected cases per month",
      };
  }
}
