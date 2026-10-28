"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

/**
 * Custom dropdown used for toolbar filters (priority, sort) and form fields.
 * Native <select> menus render with OS chrome that ignores the app's type and
 * color; this keeps the listbox semantics and keyboard model (arrows, Home/End,
 * Enter, Escape, type-ahead by first letter) while matching the rest of the UI.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  id: triggerId,
  variant = "toolbar",
  invalid,
  describedBy,
  disabled,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Accessible name; the visible text is the selected option. Omit when a <label htmlFor={id}> names it. */
  label?: string;
  /** Trigger id, so a form label can point at it. */
  id?: string;
  variant?: "toolbar" | "field";
  invalid?: boolean;
  /** Id of the error or hint text that describes the field. */
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const field = variant === "field";

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Next option (after `from`, wrapping) whose label starts with the typed letter.
  const matchLetter = (key: string, from: number) => {
    if (key.length !== 1 || !/\S/.test(key)) return -1;
    const letter = key.toLowerCase();
    for (let step = 1; step <= options.length; step++) {
      const index = (from + step) % options.length;
      if (options[index].label.toLowerCase().startsWith(letter)) return index;
    }
    return -1;
  };

  const onTriggerKey = (event: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      show();
      return;
    }
    const match = matchLetter(event.key, selectedIndex);
    if (match >= 0) onChange(options[match].value);
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
    } else {
      const match = matchLetter(event.key, active);
      if (match >= 0) setActive(match);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-describedby={describedBy}
        aria-label={label ? `${label}: ${options[selectedIndex]?.label}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onTriggerKey}
        className={cn(
          "pressable flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 text-left outline-none focus-visible:border-brand disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3",
          field ? "text-sm text-ink" : "text-[13px] font-medium text-ink-2",
          open
            ? "border-brand shadow-[0_0_0_3px_rgb(30_111_217/0.14)]"
            : invalid
              ? "border-danger"
              : "border-line-strong hover:border-ink-4/50",
        )}
      >
        <span className="truncate">{options[selectedIndex]?.label}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-out", open && "rotate-180")}
        />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-labelledby={label ? undefined : triggerId}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          className="absolute top-full left-0 z-30 mt-1.5 max-h-72 min-w-full origin-top overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop outline-none animate-popover-in"
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
                  "flex h-9 cursor-pointer items-center justify-between gap-6 rounded-md px-2.5 whitespace-nowrap",
                  field ? "text-sm" : "text-[13px]",
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
