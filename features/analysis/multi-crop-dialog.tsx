"use client";

import { Check, Crop, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";

import { Alert } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { ImageValidationError, toPng, type CropRect } from "@/lib/image";

// Crop several signatures out of one image (e.g. a specimen sheet). Frames are
// filled into slots in drawing order: SIG 01–04, then optionally the questioned
// signature. Each crop is re-encoded to PNG exactly like the single crop.

const HANDLE_HIT = 0.025;
const MIN_SIZE = 0.02;

type DragMode = "draw" | "move" | "nw" | "ne" | "sw" | "se";

export interface MultiCropResult {
  references: Blob[];
  suspect: Blob | null;
}

interface Slot {
  label: string;
  questioned: boolean;
}

const REFERENCE_SLOTS: Slot[] = [1, 2, 3, 4].map((n) => ({ label: `SIG 0${n}`, questioned: false }));
const QUESTIONED_SLOT: Slot = { label: "QUESTIONED", questioned: true };

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function MultiCropDialog({
  file,
  onCancel,
  onComplete,
}: {
  file: File | null;
  onCancel: () => void;
  onComplete: (result: MultiCropResult) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<CropRect[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [includeQuestioned, setIncludeQuestioned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: DragMode; index: number; startX: number; startY: number; start: CropRect } | null>(null);
  const maskId = useId();

  const slots = includeQuestioned ? [...REFERENCE_SLOTS, QUESTIONED_SLOT] : REFERENCE_SLOTS;
  const max = slots.length;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Reset per file; the URL must exist before the dialog renders the image.
    queueMicrotask(() => {
      setSourceUrl(url);
      setBoxes([]);
      setSelected(null);
      setError(null);
    });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const point = (event: PointerEvent) => {
    const box = stageRef.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) };
  };

  const cornerAt = (rect: CropRect, x: number, y: number): DragMode | null => {
    const corners: [DragMode, number, number][] = [
      ["nw", rect.x, rect.y],
      ["ne", rect.x + rect.width, rect.y],
      ["sw", rect.x, rect.y + rect.height],
      ["se", rect.x + rect.width, rect.y + rect.height],
    ];
    for (const [mode, cx, cy] of corners) {
      if (Math.abs(x - cx) < HANDLE_HIT && Math.abs(y - cy) < HANDLE_HIT * 1.5) return mode;
    }
    return null;
  };

  const updateBox = (index: number, rect: CropRect) => setBoxes((current) => current.map((box, i) => (i === index ? rect : box)));

  const removeBox = (index: number) => {
    setBoxes((current) => current.filter((_, i) => i !== index));
    setSelected(null);
  };

  const onPointerDown = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an enhancement; dragging still works without it.
    }
    const { x, y } = point(event);

    if (selected !== null && boxes[selected]) {
      const corner = cornerAt(boxes[selected], x, y);
      if (corner) {
        drag.current = { mode: corner, index: selected, startX: x, startY: y, start: boxes[selected] };
        return;
      }
    }
    // Topmost (last drawn) box under the pointer wins.
    for (let index = boxes.length - 1; index >= 0; index--) {
      const box = boxes[index];
      if (x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height) {
        setSelected(index);
        drag.current = { mode: "move", index, startX: x, startY: y, start: box };
        return;
      }
    }
    if (boxes.length >= max) {
      setSelected(null);
      return;
    }
    const index = boxes.length;
    const rect = { x, y, width: 0, height: 0 };
    setBoxes((current) => [...current, rect]);
    setSelected(index);
    drag.current = { mode: "draw", index, startX: x, startY: y, start: rect };
  };

  const onPointerMove = (event: PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const { x, y } = point(event);
    const { start } = state;
    if (state.mode === "draw") {
      updateBox(state.index, {
        x: Math.min(state.startX, x),
        y: Math.min(state.startY, y),
        width: Math.abs(x - state.startX),
        height: Math.abs(y - state.startY),
      });
    } else if (state.mode === "move") {
      updateBox(state.index, {
        ...start,
        x: clamp(start.x + (x - state.startX), 0, 1 - start.width),
        y: clamp(start.y + (y - state.startY), 0, 1 - start.height),
      });
    } else {
      const left = state.mode === "nw" || state.mode === "sw" ? x : start.x;
      const right = state.mode === "ne" || state.mode === "se" ? x : start.x + start.width;
      const top = state.mode === "nw" || state.mode === "ne" ? y : start.y;
      const bottom = state.mode === "sw" || state.mode === "se" ? y : start.y + start.height;
      updateBox(state.index, {
        x: Math.min(left, right),
        y: Math.min(top, bottom),
        width: Math.abs(right - left),
        height: Math.abs(bottom - top),
      });
    }
  };

  const onPointerUp = () => {
    const state = drag.current;
    drag.current = null;
    if (state?.mode !== "draw") return;
    const box = boxes[state.index];
    // A click without a drag draws nothing.
    if (!box || box.width < MIN_SIZE || box.height < MIN_SIZE) removeBox(state.index);
  };

  const toggleQuestioned = (value: boolean) => {
    setIncludeQuestioned(value);
    // Turning it off drops a fifth frame, since it has no slot to go to.
    if (!value && boxes.length > REFERENCE_SLOTS.length) {
      setBoxes((current) => current.slice(0, REFERENCE_SLOTS.length));
      setSelected(null);
    }
  };

  // The questioned signature needs all four references (same rule as the slots).
  const ready = boxes.length > 0 && (!includeQuestioned || boxes.length === max);

  const apply = async () => {
    if (!file || !ready) return;
    setProcessing(true);
    setError(null);
    try {
      const crops = await Promise.all(boxes.map((box) => toPng(file, box)));
      onComplete({ references: crops.slice(0, REFERENCE_SLOTS.length), suspect: crops[REFERENCE_SLOTS.length] ?? null });
    } catch (applyError) {
      setError(
        applyError instanceof ImageValidationError
          ? applyError.message
          : "Failed to process the selected image. Choose a different image and try again.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const nextSlot = boxes.length < max ? slots[boxes.length] : null;

  return (
    <Dialog
      open={file !== null}
      onClose={onCancel}
      dismissible={!processing}
      size="full"
      title="Crop several signatures"
      description="Draw one frame per signature. Frames fill the slots in the order you draw them."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={processing} className="sm:mr-auto">
            Cancel
          </Button>
          <Button icon={<Crop className="size-4" />} onClick={() => void apply()} loading={processing} disabled={!ready}>
            {boxes.length > 0 ? `Add ${boxes.length} ${boxes.length === 1 ? "crop" : "crops"}` : "Add crops"}
          </Button>
        </>
      }
    >
      {error ? (
        <Alert tone="error" className="mb-3">
          {error}
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex justify-center rounded-lg bg-sunken p-3">
          {sourceUrl ? (
            <div
              ref={stageRef}
              tabIndex={0}
              aria-label="Crop area. Delete removes the selected frame."
              className="relative inline-block max-w-full touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-brand"
              style={{ cursor: boxes.length < max ? "crosshair" : "default" }}
              onKeyDown={(event) => {
                if ((event.key === "Delete" || event.key === "Backspace") && selected !== null) {
                  event.preventDefault();
                  removeBox(selected);
                }
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={sourceUrl} alt="Image to crop" draggable={false} className="block max-h-[62dvh] w-auto max-w-full" />
              {boxes.length > 0 ? (
                // Dim everything outside the frames.
                <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1 1" preserveAspectRatio="none">
                  <mask id={maskId}>
                    <rect width="1" height="1" fill="white" />
                    {boxes.map((box, index) => (
                      <rect key={index} x={box.x} y={box.y} width={box.width} height={box.height} fill="black" />
                    ))}
                  </mask>
                  <rect width="1" height="1" fill="rgb(15 23 42 / 0.45)" mask={`url(#${maskId})`} />
                </svg>
              ) : null}
              {boxes.map((box, index) => {
                const slot = slots[index];
                const active = selected === index;
                return (
                  <div
                    key={index}
                    className={cn(
                      "absolute border-2",
                      slot.questioned ? "border-caution" : "border-brand",
                      active ? "z-10" : "border-dashed",
                    )}
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.width * 100}%`,
                      height: `${box.height * 100}%`,
                      cursor: "move",
                    }}
                  >
                    <span
                      className={cn(
                        "absolute -top-0.5 -left-0.5 flex -translate-y-full items-center gap-1 rounded-t-[5px] py-0.5 pr-1 pl-2 text-[11px] font-bold tracking-[0.02em] whitespace-nowrap text-white",
                        slot.questioned ? "bg-caution" : "bg-brand",
                      )}
                    >
                      {slot.label}
                      <button
                        type="button"
                        aria-label={`Remove ${slot.label} frame`}
                        onClick={() => removeBox(index)}
                        className="flex size-4 items-center justify-center rounded-sm hover:bg-white/20"
                      >
                        <X className="size-3" strokeWidth={3} />
                      </button>
                    </span>
                    {active
                      ? ["-top-1.5 -left-1.5", "-top-1.5 -right-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((pos) => (
                          <span
                            key={pos}
                            className={cn(
                              "absolute size-3 rounded-full border-2 bg-white",
                              slot.questioned ? "border-caution" : "border-brand",
                              pos,
                            )}
                          />
                        ))
                      : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-64" />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <ol className="flex flex-col gap-1.5" aria-label="Slots">
            {slots.map((slot, index) => {
              const done = index < boxes.length;
              const next = index === boxes.length;
              return (
                <li
                  key={slot.label}
                  className={cn(
                    "flex h-10 items-center gap-2.5 rounded-md border px-3 text-[13px] transition-colors duration-150",
                    next ? "border-brand bg-brand-soft/60" : "border-line bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                      done ? (slot.questioned ? "bg-caution text-white" : "bg-brand text-white") : "bg-sunken text-ink-4",
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className={cn("font-semibold", slot.questioned ? "text-caution" : "text-ink")}>{slot.label}</span>
                  <span className="ml-auto text-[12px] text-ink-4">{done ? "Framed" : next ? "Draw next" : ""}</span>
                </li>
              );
            })}
          </ol>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-surface p-3 text-[13px]">
            <input
              type="checkbox"
              checked={includeQuestioned}
              onChange={(event) => toggleQuestioned(event.target.checked)}
              className="mt-0.5 size-4 accent-brand"
            />
            <span>
              <span className="font-semibold text-ink">Also crop the questioned signature</span>
              <span className="mt-0.5 block text-[12px] text-ink-3">
                Only when it&apos;s on this same image. It becomes the 5th frame and needs all four references.
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between text-[12.5px] text-ink-3">
            <span>{nextSlot ? `Drag on the image to frame ${nextSlot.label}.` : "All slots framed. Drag a frame to adjust."}</span>
            {boxes.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setBoxes([]);
                  setSelected(null);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 font-semibold text-ink-2 hover:bg-sunken"
              >
                <Trash2 className="size-3.5" /> Clear
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </Dialog>
  );
}
