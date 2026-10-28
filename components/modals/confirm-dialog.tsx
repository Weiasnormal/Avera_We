"use client";

import { AlertTriangle, CircleCheck, Info } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// Confirmation, destructive confirmation and type-to-confirm dialogs
// (mobile: confirm_action, logout, delete_account, type_to_confirm, draft_saved).

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone={tone}
      icon={tone === "danger" ? <AlertTriangle className="size-[18px]" /> : <Info className="size-[18px]" />}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={() => void onConfirm()} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

interface TypeToConfirmDialogProps extends Omit<ConfirmDialogProps, "children"> {
  phrase: string;
}

export function TypeToConfirmDialog({ phrase, open, onClose, ...props }: TypeToConfirmDialogProps) {
  const [value, setValue] = useState("");
  const matches = value.trim() === phrase;
  const close = () => {
    setValue("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={props.title}
      description={props.description}
      tone="danger"
      icon={<AlertTriangle className="size-[18px]" />}
      size="sm"
      dismissible={!props.loading}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={props.loading}>
            {props.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant="danger" disabled={!matches} loading={props.loading} onClick={() => void props.onConfirm()}>
            {props.confirmLabel}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5 pb-2 text-[13px] text-ink-2">
        <span>
          Type <span className="font-mono font-semibold text-ink">{phrase}</span> to continue
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          className="h-10 rounded-md border border-line-strong px-3 font-mono text-sm outline-none focus:border-danger focus:shadow-[0_0_0_3px_rgb(217_58_57/0.14)]"
        />
      </label>
    </Dialog>
  );
}

interface NoticeDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  tone: "success" | "error";
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/** Success / error message dialog (mobile success_modal / error_modal). */
export function NoticeDialog({
  open,
  onClose,
  title,
  message,
  tone,
  primaryLabel = "OK",
  onPrimary,
  secondaryLabel,
  onSecondary,
}: NoticeDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      tone={tone === "error" ? "danger" : "default"}
      icon={tone === "error" ? <AlertTriangle className="size-[18px]" /> : <CircleCheck className="size-[18px]" />}
      footer={
        <>
          {secondaryLabel ? (
            <Button variant="secondary" onClick={onSecondary ?? onClose}>
              {secondaryLabel}
            </Button>
          ) : null}
          <Button onClick={onPrimary ?? onClose}>{primaryLabel}</Button>
        </>
      }
    />
  );
}
