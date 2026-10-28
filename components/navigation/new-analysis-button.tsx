"use client";

import { ChevronRight, Plus, Signature } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { useAnalysisStore } from "@/stores/analysis";
import { isCreatedToday, useCasesStore } from "@/stores/cases";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

/** Daily case limit check from the mobile user_dashboard. */
export function useCaseLimit() {
  const limit = useSessionStore((state) => state.profile?.dailyCaseLimit ?? null);
  const casesToday = useCasesStore((state) => state.cases.filter((item) => isCreatedToday(item.createdAt)).length);
  return { limit, casesToday, reached: limit !== null && casesToday >= limit };
}

export function NewAnalysisButton({
  className,
  size = "md",
  variant = "button",
  onNavigate,
}: {
  className?: string;
  size?: "sm" | "md";
  /** "card" is the mobile Start-analysis tile; "button" fits toolbars. */
  variant?: "button" | "card";
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { reached } = useCaseLimit();

  const start = () => {
    if (reached) {
      toast.error("Contact your admin. Your case limit has been reached.");
      return;
    }
    useAnalysisStore.getState().startNewDraft();
    onNavigate?.();
    router.push(routes.examiner.newAnalysis);
  };

  if (variant === "card") {
    const compact = size === "sm";
    return (
      <button
        type="button"
        onClick={start}
        className={cn(
          "pressable group flex w-full items-center rounded-xl bg-brand text-left text-white hover:bg-brand-strong",
          compact ? "gap-3 px-3 py-2.5" : "gap-4 px-4 py-3.5 sm:px-5 sm:py-4",
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center bg-white text-brand",
            compact ? "size-9 rounded-[9px]" : "size-12 rounded-xl",
          )}
        >
          <Signature className={compact ? "size-4.5" : "size-6"} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block font-medium tracking-[0.08em] text-white/80", compact ? "text-[10px]" : "text-[11.5px]")}>
            START ANALYSIS
          </span>
          <span className={cn("block leading-tight font-bold", compact ? "text-[15px]" : "text-[19px]")}>Signature</span>
        </span>
        <ChevronRight
          aria-hidden
          className={cn("shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5", compact ? "size-4" : "size-5")}
          strokeWidth={2.5}
        />
      </button>
    );
  }

  return (
    <Button size={size} className={className} icon={<Plus className="size-4" />} onClick={start}>
      New analysis
    </Button>
  );
}
