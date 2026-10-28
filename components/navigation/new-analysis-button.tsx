"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
  onNavigate,
}: {
  className?: string;
  size?: "sm" | "md";
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { reached } = useCaseLimit();

  return (
    <Button
      size={size}
      className={className}
      icon={<Plus className="size-4" />}
      onClick={() => {
        if (reached) {
          toast.error("Contact your admin. Your case limit has been reached.");
          return;
        }
        useAnalysisStore.getState().startNewDraft();
        onNavigate?.();
        router.push(routes.examiner.newAnalysis);
      }}
    >
      New analysis
    </Button>
  );
}
