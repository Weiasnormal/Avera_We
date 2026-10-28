import { cn } from "@/lib/cn";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-5 animate-spin [animation-duration:700ms]", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

/** Thin indeterminate bar for "working, no exact progress" states. */
export function IndeterminateBar({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-1 overflow-hidden rounded-full bg-brand-soft", className)} role="progressbar" aria-busy>
      <div className="absolute inset-y-0 w-2/5 rounded-full bg-brand animate-[indeterminate_1.1s_var(--ease-in-out)_infinite]" />
    </div>
  );
}
