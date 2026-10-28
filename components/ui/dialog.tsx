"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { IconButton } from "./button";

// Shared dialog foundation on the native <dialog> element: the browser provides
// modality, focus trapping, Escape handling and top-layer stacking. Feature
// dialogs (components/modals/*) compose this rather than re-implementing it.

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Prevent closing via Escape / backdrop (e.g. while a request is running). */
  dismissible?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  tone?: "default" | "danger";
  icon?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

const SIZES = {
  sm: "sm:max-w-100",
  md: "sm:max-w-120",
  lg: "sm:max-w-160",
  xl: "sm:max-w-220",
  full: "sm:max-w-[min(1200px,calc(100vw-48px))]",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = "md",
  tone = "default",
  icon,
  className,
  bodyClassName,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dismissibleRef = useRef(dismissible);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    dismissibleRef.current = dismissible;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (dismissibleRef.current) onCloseRef.current();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        // Clicks on the ::backdrop land on the <dialog> element itself.
        if (event.target === ref.current && dismissibleRef.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto w-full max-w-none max-h-[92dvh] overflow-hidden rounded-t-xl bg-surface p-0 text-ink shadow-pop",
        "sm:m-auto sm:rounded-lg",
        "open:animate-rise-in backdrop:animate-fade-in",
        SIZES[size],
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-start gap-3 px-5 pt-5 pb-3 sm:px-6">
            {icon ? (
              <div
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                  tone === "danger" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand",
                )}
              >
                {icon}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-[17px] font-bold leading-snug text-ink">
                {title}
              </h2>
              {description ? (
                <div id={descriptionId} className="mt-1 text-[13.5px] leading-relaxed text-ink-3">
                  {description}
                </div>
              ) : null}
            </div>
            {dismissible ? (
              <IconButton label="Close" size="sm" onClick={onClose} className="-mt-1 -mr-2">
                <X className="size-4" />
              </IconButton>
            ) : null}
          </header>
          {children ? (
            <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-2 sm:px-6", bodyClassName)}>{children}</div>
          ) : null}
          {footer ? (
            <footer className="flex flex-col-reverse gap-2 px-5 pt-3 pb-5 sm:flex-row sm:justify-end sm:px-6">{footer}</footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
