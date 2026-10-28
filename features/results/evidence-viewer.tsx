"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { ImageViewer } from "@/components/modals/image-viewer";
import { Segmented } from "@/components/ui/controls";
import { EvidenceImage } from "@/components/ui/evidence-image";
import { readPreference } from "@/lib/preferences";
import { caseImageUrls, findOverlay } from "@/services/cases";
import {
  REFERENCE_SLOTS,
  RESULT_VIEW_MODES,
  VIEW_MODE_TO_VARIANT,
  type GradCamImage,
  type ResultViewMode,
} from "@/types/case";

// Reference and questioned signatures with the ML service's explainability
// images (Heatmap / Bounding Box / Stroke Diff). Images are shown exactly as the
// backend produced them; "Original" shows the uploaded scans.

type Mode = ResultViewMode | "Original";

export const DEFAULT_VIEW_PREF = "defaultResultView";

export function EvidenceViewer({ caseId, overlays }: { caseId: string; overlays: GradCamImage[] }) {
  const [mode, setMode] = useState<Mode>(() => readPreference<ResultViewMode>(DEFAULT_VIEW_PREF, "Heatmap"));
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null);

  const imageFor = (slot: (typeof REFERENCE_SLOTS)[number] | "Suspected", index: number) => {
    const original = slot === "Suspected" ? caseImageUrls.suspected(caseId) : caseImageUrls.reference(caseId, index + 1);
    if (mode === "Original") return { src: original, isOverlay: false };
    const overlay = findOverlay(overlays, slot, VIEW_MODE_TO_VARIANT[mode]);
    return overlay ? { src: caseImageUrls.overlay(caseId, overlay.imageId), isOverlay: true } : { src: original, isOverlay: false };
  };

  const hasAnyOverlay = mode === "Original" || overlays.some((item) => item.variant === VIEW_MODE_TO_VARIANT[mode]);
  const suspect = imageFor("Suspected", 0);

  return (
    <section aria-label="Signature evidence" className="rounded-lg border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold">Signature evidence</h2>
          <p className="text-[12.5px] text-ink-3">Model explainability output for each sample</p>
        </div>
        <Segmented
          label="Evidence view"
          size="sm"
          className="w-full sm:w-auto"
          value={mode}
          onChange={setMode}
          options={[...RESULT_VIEW_MODES, "Original" as const].map((value) => ({ value, label: value }))}
        />
      </header>

      {!hasAnyOverlay ? (
        <p className="flex items-center gap-2 border-b border-line bg-canvas px-5 py-2.5 text-[12.5px] text-ink-3">
          <Info className="size-3.5 shrink-0" aria-hidden />
          The analysis did not return {mode.toLowerCase()} images for this case; the uploaded scans are shown instead.
        </p>
      ) : null}

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          <p className="mb-2 text-[12px] font-bold tracking-[0.02em] text-ink-3">REFERENCES</p>
          <div className="grid grid-cols-2 gap-3">
            {REFERENCE_SLOTS.map((slot, index) => {
              const image = imageFor(slot, index);
              const label = `SIG ${String(index + 1).padStart(2, "0")}`;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setPreview({ src: image.src, title: `${label} — ${image.isOverlay ? mode : "Uploaded reference"}` })}
                  className="group overflow-hidden rounded-md border border-line text-left transition-[border-color,box-shadow] duration-150 hover:border-brand-line hover:shadow-card"
                >
                  <EvidenceImage src={image.src} alt={`${label} ${mode}`} className="aspect-4/3" />
                  <span className="flex items-center justify-between border-t border-line px-2.5 py-1.5 text-[12px]">
                    <span className="font-semibold text-ink">{label}</span>
                    <span className="text-ink-4">{image.isOverlay ? mode : "Original"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[12px] font-bold tracking-[0.02em] text-caution">QUESTIONED</p>
          <button
            type="button"
            onClick={() => setPreview({ src: suspect.src, title: `Suspected signature — ${suspect.isOverlay ? mode : "Uploaded"}` })}
            className="group block w-full overflow-hidden rounded-md border border-caution-line text-left transition-shadow duration-150 hover:shadow-card"
          >
            <EvidenceImage src={suspect.src} alt={`Suspected signature ${mode}`} className="aspect-4/3 lg:aspect-auto lg:h-[calc(100%-2rem)] lg:min-h-75" />
            <span className="flex items-center justify-between border-t border-caution-line bg-caution-soft/50 px-3 py-1.5 text-[12px]">
              <span className="font-semibold text-ink">Suspected signature</span>
              <span className="text-ink-4">{suspect.isOverlay ? mode : "Original"} · click to enlarge</span>
            </span>
          </button>
        </div>
      </div>

      <ImageViewer src={preview?.src ?? null} title={preview?.title ?? ""} onClose={() => setPreview(null)} />
    </section>
  );
}
