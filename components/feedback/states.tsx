import { AlertTriangle, CircleCheck, Info } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  illustration,
  compact = false,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  illustration?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-8" : "py-14", className)}>
      {illustration ? (
        <Image src={illustration} alt="" width={compact ? 96 : 140} height={compact ? 96 : 140} className="mb-4 h-auto" />
      ) : null}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-[46ch] text-[13.5px] text-ink-3">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

type AlertTone = "error" | "info" | "success" | "caution";

const ALERT_TONES: Record<AlertTone, string> = {
  error: "border-suspect-line bg-suspect-soft text-[#8f2423]",
  info: "border-brand-line bg-brand-soft text-brand-strong",
  success: "border-genuine-line bg-genuine-soft text-[#14532d]",
  caution: "border-caution-line bg-caution-soft text-[#7c3a0a]",
};

export function Alert({
  tone = "error",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = tone === "error" || tone === "caution" ? AlertTriangle : tone === "success" ? CircleCheck : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-md border px-3.5 py-3 text-[13.5px] animate-fade-in", ALERT_TONES[tone], className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "leading-relaxed")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Full-area load error with a retry. */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-suspect-soft text-suspect">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <p className="text-[15px] font-semibold text-ink">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="pressable mt-4 h-9 rounded-md border border-line-strong bg-surface px-4 text-[13px] font-semibold text-ink hover:bg-canvas"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
