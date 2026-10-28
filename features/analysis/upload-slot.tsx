"use client";

import { ImagePlus, Lock, RefreshCw, Trash2, ZoomIn } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { cn } from "@/lib/cn";

function SlotAction({
  label,
  title,
  onClick,
  disabled,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className="pressable flex size-7 items-center justify-center rounded-md bg-white/95 text-ink shadow-card hover:bg-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}
import { ACCEPTED_IMAGE_EXTENSIONS } from "@/lib/image";
import type { SignatureImage } from "@/stores/analysis";

/**
 * One evidence slot: browser file picker + drag-and-drop, preview, replace,
 * remove. Replaces the mobile UploadSlot + ML Kit scanner entry point.
 */
export function UploadSlot({
  label,
  caption,
  image,
  onSelect,
  onRemove,
  onPreview,
  locked,
  lockedMessage,
  variant = "reference",
  disabled,
}: {
  label: string;
  caption: string;
  image: SignatureImage | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onPreview: () => void;
  locked?: boolean;
  lockedMessage?: string;
  variant?: "reference" | "suspect";
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const isSuspect = variant === "suspect";

  const openPicker = () => {
    if (!locked && !disabled) inputRef.current?.click();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (locked || disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onSelect(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className={cn("text-[12.5px] font-bold tracking-[0.02em]", isSuspect ? "text-caution" : "text-ink-2")}>{label}</span>
        <span className="text-[12px] text-ink-4">{caption}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_EXTENSIONS}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onSelect(file);
        }}
      />

      {image ? (
        <div
          className={cn(
            "group relative overflow-hidden rounded-lg border bg-surface",
            isSuspect ? "aspect-[16/7] border-caution-line" : "aspect-[4/3] border-line-strong",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <button type="button" onClick={onPreview} className="evidence-bg absolute inset-0" aria-label={`Preview ${label}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={image.previewUrl} alt={`${label} preview`} className="size-full object-contain p-2" />
          </button>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-ink/55 to-transparent px-2.5 pt-6 pb-2 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <span className="truncate text-[11.5px] font-medium text-white/90">{image.sourceName}</span>
            <div className="flex shrink-0 gap-1">
              <SlotAction label={`Preview ${label}`} title="Preview" onClick={onPreview} disabled={disabled}>
                <ZoomIn className="size-3.5" />
              </SlotAction>
              <SlotAction label={`Replace ${label}`} title="Replace" onClick={openPicker} disabled={disabled}>
                <RefreshCw className="size-3.5" />
              </SlotAction>
              <SlotAction label={`Remove ${label}`} title="Remove" onClick={onRemove} disabled={disabled}>
                <Trash2 className="size-3.5" />
              </SlotAction>
            </div>
          </div>
          {dragging ? <div className="absolute inset-0 border-2 border-dashed border-brand bg-brand-soft/70" /> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-disabled={locked || undefined}
          onDragOver={(event) => {
            event.preventDefault();
            if (!locked) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 text-center transition-colors duration-150",
            isSuspect ? "aspect-[16/7]" : "aspect-[4/3]",
            locked
              ? "cursor-not-allowed border-line bg-canvas text-ink-4"
              : dragging
                ? "border-brand bg-brand-soft text-brand"
                : isSuspect
                  ? "border-caution-line bg-caution-soft/60 text-caution hover:border-caution hover:bg-caution-soft"
                  : "border-line-strong bg-surface text-ink-3 hover:border-brand hover:bg-brand-soft/40 hover:text-brand",
          )}
        >
          {locked ? <Lock className="size-5" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
          <span className="text-[13px] font-semibold">
            {locked ? lockedMessage : dragging ? "Drop to add" : isSuspect ? "Add suspected signature" : "Add image"}
          </span>
          {!locked ? <span className="hidden text-[12px] text-ink-4 sm:block">Click to browse or drop a file</span> : null}
        </button>
      )}
    </div>
  );
}
