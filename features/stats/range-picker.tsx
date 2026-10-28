"use client";

import { Segmented } from "@/components/ui/controls";

import { TIME_RANGES, rangeLabel, type TimeRange } from "./compute";

const OPTIONS = TIME_RANGES.map((value) => ({ value, label: rangeLabel(value) }));

/** The one time-range control on a statistics page; every card and chart follows it. */
export function RangePicker({ value, onChange }: { value: TimeRange; onChange: (value: TimeRange) => void }) {
  return <Segmented label="Time range" value={value} onChange={onChange} options={OPTIONS} />;
}
