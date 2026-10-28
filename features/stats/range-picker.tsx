"use client";

import { Segmented } from "@/components/ui/controls";
import { Select } from "@/components/ui/select";

import { TIME_RANGES, rangeLabel, type TimeRange } from "./compute";

const OPTIONS = TIME_RANGES.map((value) => ({ value, label: rangeLabel(value) }));

/** The one time-range control on a statistics page; every card and chart follows it. */
export function RangePicker({ value, onChange }: { value: TimeRange; onChange: (value: TimeRange) => void }) {
  return (
    <>
      <div className="w-40 lg:hidden">
        <Select label="Time range" value={value} onChange={onChange} options={OPTIONS} variant="field" />
      </div>
      <div className="hidden lg:block">
        <Segmented label="Time range" value={value} onChange={onChange} options={OPTIONS} />
      </div>
    </>
  );
}
