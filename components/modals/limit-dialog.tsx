"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Numeric limit editor (mobile member_limit modal and daily case limit sheet). */
export function LimitDialog({
  open,
  onClose,
  onSave,
  title,
  description,
  initial,
  min,
  max,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (value: number) => Promise<boolean>;
  title: string;
  description: string;
  initial: number;
  min: number;
  max: number;
  unit: string;
}) {
  const [draft, setDraft] = useState(String(initial));
  const [saving, setSaving] = useState(false);
  const [openedWith, setOpenedWith] = useState<number | null>(null);

  // Reset the draft each time the dialog opens.
  if (open && openedWith !== initial) {
    setOpenedWith(initial);
    setDraft(String(Math.min(max, Math.max(min, initial))));
  }
  if (!open && openedWith !== null) setOpenedWith(null);

  const value = Number(draft);
  const valid = draft.trim() !== "" && Number.isInteger(value) && value >= min && value <= max;

  const step = (delta: number) => setDraft(String(Math.min(max, Math.max(min, (Number(draft) || min) + delta))));

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSave(value);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!valid} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease"
            onClick={() => step(-1)}
            disabled={value <= min}
            className="pressable flex size-11 items-center justify-center rounded-md border border-line-strong text-ink-2 hover:bg-canvas disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <input
            aria-label={title}
            inputMode="numeric"
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") step(1);
              if (event.key === "ArrowDown") step(-1);
              if (event.key === "Enter") void save();
            }}
            className="h-14 w-24 rounded-md border border-line-strong text-center text-[26px] font-bold tabular outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgb(30_111_217/0.14)]"
          />
          <button
            type="button"
            aria-label="Increase"
            onClick={() => step(1)}
            disabled={value >= max}
            className="pressable flex size-11 items-center justify-center rounded-md border border-line-strong text-ink-2 hover:bg-canvas disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <p className={valid ? "text-[12.5px] text-ink-3" : "text-[12.5px] font-medium text-danger"}>
          {unit} · between {min} and {max}
        </p>
      </div>
    </Dialog>
  );
}
