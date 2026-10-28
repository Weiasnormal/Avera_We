"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useRef, useState } from "react";

import { IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// Full-size evidence preview with zoom and pan (mobile ZoomableImageModal).

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

export function ImageViewer({
  src,
  title,
  onClose,
}: {
  src: string | null;
  title: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const setClampedZoom = (value: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    setZoom(next);
    if (next === 1) setOffset({ x: 0, y: 0 });
  };

  const close = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    onClose();
  };

  return (
    <Dialog open={src !== null} onClose={close} title={title} size="full" bodyClassName="px-0 pb-0 sm:px-0">
      <div className="flex items-center justify-end gap-1 border-y border-line bg-canvas px-3 py-1.5">
        <span className="mr-auto pl-2 text-[12px] text-ink-3 tabular">{Math.round(zoom * 100)}%</span>
        <IconButton label="Zoom out" size="sm" onClick={() => setClampedZoom(zoom / 1.5)} disabled={zoom <= MIN_ZOOM}>
          <Minus className="size-4" />
        </IconButton>
        <IconButton label="Zoom in" size="sm" onClick={() => setClampedZoom(zoom * 1.5)} disabled={zoom >= MAX_ZOOM}>
          <Plus className="size-4" />
        </IconButton>
        <IconButton label="Fit to screen" size="sm" onClick={() => setClampedZoom(1)} disabled={zoom === 1}>
          <Maximize2 className="size-4" />
        </IconButton>
      </div>
      <div
        className="evidence-bg relative h-[min(72dvh,760px)] touch-none overflow-hidden select-none"
        style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
        onWheel={(event) => setClampedZoom(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15))}
        onDoubleClick={() => setClampedZoom(zoom > 1 ? 1 : 2.5)}
        onPointerDown={(event) => {
          if (zoom === 1) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setOffset({
            x: drag.current.ox + (event.clientX - drag.current.x),
            y: drag.current.oy + (event.clientY - drag.current.y),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated proxy image
          <img
            src={src}
            alt={title}
            draggable={false}
            className="absolute inset-0 size-full object-contain transition-transform duration-150 ease-[var(--ease-out)]"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          />
        ) : null}
      </div>
    </Dialog>
  );
}
