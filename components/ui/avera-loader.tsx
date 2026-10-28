import { cn } from "@/lib/cn";

// The Avera "A" (two legs + the crossing swoosh) drawn as strokes. A faint copy
// sits underneath so the mark never reads as empty between draw cycles.
const LEGS = "M11 39 L21.6 11.6 Q24 6.4 26.4 11.6 L37 39";
const SWOOSH = "M7.5 37.5 C18 36.5 28.5 31 40.5 19";

/** Branded loader for page- and section-level waits. Use Spinner inside buttons. */
export function AveraLoader({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-10 text-brand", className)}
    >
      <g stroke="currentColor" strokeOpacity="0.14" strokeWidth="4.5">
        <path d={LEGS} />
        <path d={SWOOSH} />
      </g>
      <g stroke="currentColor" strokeWidth="4.5">
        <path d={LEGS} pathLength={1} className="avera-loader-stroke" />
        <path d={SWOOSH} pathLength={1} className="avera-loader-stroke [animation-delay:180ms]" />
      </g>
    </svg>
  );
}

/** Centered loader with a caption, for full-area waiting states. */
export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-10 text-center animate-fade-in", className)} aria-live="polite">
      <AveraLoader />
      <p className="text-[14px] font-medium text-ink-3">{label}</p>
    </div>
  );
}
