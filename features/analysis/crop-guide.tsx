"use client";

import { Check, ScanLine, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Mobile crop_guide_modal: how to frame a signature before analysis. */
export function CropGuideDialog({
  open,
  showAgain,
  onShowAgainChange,
  onClose,
}: {
  open: boolean;
  showAgain: boolean;
  onShowAgainChange: (value: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Crop to the signature only"
      description="Frame the signature tightly. Leave out paper edges and printed lines."
      size="md"
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-[13px] text-ink-2">
            <input
              type="checkbox"
              checked={showAgain}
              onChange={(event) => onShowAgainChange(event.target.checked)}
              className="size-4 accent-[var(--color-brand)]"
            />
            Show this again next time
          </label>
          <Button onClick={onClose}>Got it</Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-3 rounded-md bg-brand-soft px-3.5 py-3 text-[13px] text-brand-strong">
        <ScanLine className="size-4 shrink-0" aria-hidden />
        Use a flatbed scan for best results.
      </div>
      <div className="grid grid-cols-2 gap-3 pb-2">
        <figure className="rounded-md border border-line p-3">
          <svg viewBox="0 0 140 92" className="h-auto w-full" aria-hidden>
            <path
              d="M38 58 C 44 40, 52 40, 56 52 C 60 62, 66 62, 70 48 C 74 36, 80 36, 84 50 C 87 58, 92 56, 96 46"
              fill="none"
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <rect x="30" y="30" width="72" height="34" fill="none" stroke="#1e6fd9" strokeWidth="2" />
          </svg>
          <figcaption className="mt-2">
            <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">
              <Check className="size-3.5" /> Correct
            </span>
            <span className="text-[12px] text-ink-3">Follows the signature edges.</span>
          </figcaption>
        </figure>
        <figure className="rounded-md border border-line p-3">
          <svg viewBox="0 0 140 92" className="h-auto w-full" aria-hidden>
            <line x1="14" y1="24" x2="126" y2="24" stroke="#e8edf3" />
            <line x1="14" y1="70" x2="126" y2="70" stroke="#e8edf3" />
            <path
              d="M52 52 C 56 44, 61 44, 63 50 C 65 56, 69 56, 71 48 C 73 42, 77 42, 79 49"
              fill="none"
              stroke="#0f172a"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <rect x="14" y="14" width="112" height="64" fill="none" stroke="#94a3b8" strokeWidth="2" />
          </svg>
          <figcaption className="mt-2">
            <span className="flex items-center gap-1 text-[13px] font-semibold text-ink-2">
              <X className="size-3.5" /> Too loose
            </span>
            <span className="text-[12px] text-ink-3">Includes paper edges and lines.</span>
          </figcaption>
        </figure>
      </div>
    </Dialog>
  );
}
