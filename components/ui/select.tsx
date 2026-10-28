"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

/**
 * Compact dropdown for toolbar filters (priority, sort). Native <select> menus
 * render with OS chrome that ignores the app's type and color; this keeps the
 * listbox semantics and keyboard model (arrows, Home/End, Enter, Escape) while
 * matching the rest of the UI. Forms keep native selects.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Accessible name; the visible text is the selected option. */
  label: string;
  className?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKey = (event: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      show();
    }
  };

  const onListKey = (event: KeyboardEvent) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${label}: ${options[selectedIndex]?.label}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onTriggerKey}
        className={cn(
          "pressable flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 text-[13px] font-medium text-ink-2 outline-none hover:border-ink-4/50 focus-visible:border-brand",
          open ? "border-brand shadow-[0_0_0_3px_rgb(30_111_217/0.14)]" : "border-line-strong",
        )}
      >
        <span className="truncate">{options[selectedIndex]?.label}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-[var(--ease-out)]", open && "rotate-180")}
        />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          className="absolute top-full left-0 z-30 mt-1.5 max-h-72 min-w-full origin-top overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop outline-none animate-[pop-in_160ms_var(--ease-out)]"
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex;
            return (
              <li
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex h-9 cursor-pointer items-center justify-between gap-6 rounded-md px-2.5 text-[13px] whitespace-nowrap",
                  index === active && "bg-sunken",
                  selected ? "font-semibold text-ink" : "text-ink-2",
                )}
              >
                {option.label}
                <Check aria-hidden className={cn("size-3.5 text-brand", !selected && "invisible")} strokeWidth={2.5} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
