"use client";

import { Crop, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import { Alert } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ImageValidationError, toPng, type CropRect } from "@/lib/image";

// Browser stand-in for the document scanner's crop step: draw a tight frame
// around the signature (the mobile crop guide's instruction), then the image is
// re-encoded to PNG exactly like the mobile normalizeToPng step.

const FULL: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const HANDLE_HIT = 0.03;

type DragMode = "draw" | "move" | "nw" | "ne" | "sw" | "se";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function CropDialog({
  file,
  label,
  onCancel,
  onComplete,
}: {
  file: File | null;
  label: string;
  onCancel: () => void;
  onComplete: (png: Blob) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [rect, setRect] = useState<CropRect>(FULL);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; start: CropRect } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Reset per file; the URL must exist before the dialog renders the image.
    queueMicrotask(() => {
      setSourceUrl(url);
      setRect(FULL);
      setError(null);
    });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const point = (event: PointerEvent) => {
    const box = stageRef.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) };
  };

  const hitMode = (x: number, y: number): DragMode => {
    const corners: [DragMode, number, number][] = [
      ["nw", rect.x, rect.y],
      ["ne", rect.x + rect.width, rect.y],
      ["sw", rect.x, rect.y + rect.height],
      ["se", rect.x + rect.width, rect.y + rect.height],
    ];
    for (const [mode, cx, cy] of corners) {
      if (Math.abs(x - cx) < HANDLE_HIT && Math.abs(y - cy) < HANDLE_HIT * 1.5) return mode;
    }
    const inside = x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height;
    const isFull = rect.width === 1 && rect.height === 1;
    return inside && !isFull ? "move" : "draw";
  };

  const onPointerDown = (event: PointerEvent) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an enhancement; dragging still works without it.
    }
    const { x, y } = point(event);
    const mode = hitMode(x, y);
    drag.current = { mode, startX: x, startY: y, start: rect };
    if (mode === "draw") setRect({ x, y, width: 0, height: 0 });
  };

  const onPointerMove = (event: PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const { x, y } = point(event);
    const { start } = state;
    if (state.mode === "draw") {
      setRect({
        x: Math.min(state.startX, x),
        y: Math.min(state.startY, y),
        width: Math.abs(x - state.startX),
        height: Math.abs(y - state.startY),
      });
    } else if (state.mode === "move") {
      setRect({
        ...start,
        x: clamp(start.x + (x - state.startX), 0, 1 - start.width),
        y: clamp(start.y + (y - state.startY), 0, 1 - start.height),
      });
    } else {
      const left = state.mode === "nw" || state.mode === "sw" ? x : start.x;
      const right = state.mode === "ne" || state.mode === "se" ? x : start.x + start.width;
      const top = state.mode === "nw" || state.mode === "ne" ? y : start.y;
      const bottom = state.mode === "sw" || state.mode === "se" ? y : start.y + start.height;
      setRect({
        x: Math.min(left, right),
        y: Math.min(top, bottom),
        width: Math.abs(right - left),
        height: Math.abs(bottom - top),
      });
    }
  };

  const onPointerUp = () => {
    if (drag.current?.mode === "draw" && (rect.width < 0.02 || rect.height < 0.02)) setRect(FULL);
    drag.current = null;
  };

  const apply = async (crop: CropRect | null) => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      onComplete(await toPng(file, crop));
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

  const isFull = rect.width === 1 && rect.height === 1 && rect.x === 0 && rect.y === 0;

  return (
    <Dialog
      open={file !== null}
      onClose={onCancel}
      dismissible={!processing}
      size="xl"
      title={`Crop ${label}`}
      description="Drag a tight frame around the signature only. Leave out paper edges, printed lines and stamps."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => void apply(null)} disabled={processing}>
            Use full image
          </Button>
          <Button icon={<Crop className="size-4" />} onClick={() => void apply(rect)} loading={processing} disabled={isFull}>
            Apply crop
          </Button>
        </>
      }
    >
      {error ? (
        <Alert tone="error" className="mb-3">
          {error}
        </Alert>
      ) : null}
      <div className="flex justify-center rounded-md bg-sunken p-3">
        {sourceUrl ? (
          <div
            ref={stageRef}
            className="relative inline-block max-w-full touch-none select-none"
            style={{ cursor: "crosshair" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={sourceUrl} alt={`${label} to crop`} draggable={false} className="block max-h-[58dvh] w-auto max-w-full" />
            {!isFull ? (
              <>
                {/* Dim everything outside the crop frame. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-ink/45"
                  style={{
                    clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.x * 100}% ${rect.y * 100}%, ${rect.x * 100}% ${(rect.y + rect.height) * 100}%, ${(rect.x + rect.width) * 100}% ${(rect.y + rect.height) * 100}%, ${(rect.x + rect.width) * 100}% ${rect.y * 100}%, ${rect.x * 100}% ${rect.y * 100}%)`,
                  }}
                />
                <div
                  aria-hidden
                  className="absolute border-2 border-brand"
                  style={{
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.width * 100}%`,
                    height: `${rect.height * 100}%`,
                    cursor: "move",
                  }}
                >
                  {["-top-1.5 -left-1.5", "-top-1.5 -right-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((pos) => (
                    <span key={pos} className={`absolute size-3 rounded-full border-2 border-brand bg-white ${pos}`} />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="h-64" />
        )}
      </div>
      <div className="flex items-center justify-between py-2 text-[12.5px] text-ink-3">
        <span>{isFull ? "Drag on the image to draw a crop frame." : "Drag the frame or its corners to adjust."}</span>
        {!isFull ? (
          <button
            type="button"
            onClick={() => setRect(FULL)}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 font-semibold text-ink-2 hover:bg-sunken"
          >
            <RotateCcw className="size-3.5" /> Reset
          </button>
        ) : null}
      </div>
    </Dialog>
  );
}
