"use client";

import { AlertTriangle, CircleCheck, Info, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { cn } from "@/lib/cn";
import { useToastStore, type Toast } from "@/stores/toast";

const DURATION_MS = 4200;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.action ? DURATION_MS * 2 : DURATION_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.action, toast.id]);

  const Icon = toast.tone === "error" ? AlertTriangle : toast.tone === "info" ? Info : CircleCheck;
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-md border border-line bg-surface py-3 pr-2 pl-3.5 text-[13.5px] text-ink shadow-pop animate-toast-in sm:w-95"
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          toast.tone === "error" ? "text-danger" : toast.tone === "info" ? "text-brand" : "text-genuine",
        )}
      />
      <p className="min-w-0 flex-1 leading-relaxed">{toast.message}</p>
      {toast.action ? (
        <Link
          href={toast.action.href}
          onClick={() => dismiss(toast.id)}
          className="shrink-0 rounded-sm px-1.5 py-0.5 text-[13px] font-semibold text-brand hover:underline"
        >
          {toast.action.label}
        </Link>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
        className="flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-4 hover:bg-sunken hover:text-ink-2"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
