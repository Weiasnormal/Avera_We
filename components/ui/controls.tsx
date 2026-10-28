"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Segmented control with a sliding indicator (mobile view-mode tabs / role tabs). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
}: {
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    if (!list || !active) return;
    const update = () => setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [value, options]);

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      className={cn("relative inline-flex max-w-full overflow-x-auto rounded-md bg-sunken p-1 [scrollbar-width:none]", className)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const index = options.findIndex((option) => option.value === value);
        const next = options[(index + (event.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
        onChange(next.value);
        requestAnimationFrame(() =>
          listRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(),
        );
      }}
    >
      {indicator ? (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-[7px] bg-surface shadow-card transition-[left,width] duration-200 ease-[var(--ease-out)]"
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex-1 rounded-[7px] px-2.5 font-semibold whitespace-nowrap transition-colors duration-150 sm:px-3",
              size === "sm" ? "h-7 text-[12.5px]" : "h-8 text-[13px]",
              selected ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3 py-3">
      {icon ? <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-2">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[14px] font-semibold text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[13px] text-ink-3">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-[0_1px_2px_rgb(15_23_42/0.25)] transition-transform duration-200 ease-[var(--ease-out)]",
            checked && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}

/** Segmented single-character inputs for invite / verification codes. */
export function CodeInput({
  length,
  value,
  onChange,
  pattern,
  label,
  separatorAfter,
  disabled,
  invalid,
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Allowed characters for each position. */
  pattern: (index: number) => RegExp;
  label: string;
  separatorAfter?: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, index) => value[index] ?? "");

  const setFromIndex = (start: number, input: string) => {
    const next = [...chars];
    let cursor = start;
    for (const char of input.toUpperCase()) {
      if (cursor >= length) break;
      if (!pattern(cursor).test(char)) continue;
      next[cursor] = char;
      cursor += 1;
    }
    onChange(next.join("").slice(0, length));
    refs.current[Math.min(cursor, length - 1)]?.focus();
  };

  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      {chars.map((char, index) => (
        <div key={index} className="contents">
          <input
            ref={(element) => {
              refs.current[index] = element;
            }}
            value={char}
            disabled={disabled}
            inputMode={pattern(index).test("1") && !pattern(index).test("A") ? "numeric" : "text"}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`${label} character ${index + 1}`}
            aria-invalid={invalid || undefined}
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              const raw = event.target.value.replace(char, "") || event.target.value;
              if (!raw) {
                const next = [...chars];
                next[index] = "";
                onChange(next.join(""));
                return;
              }
              setFromIndex(index, raw);
            }}
            onPaste={(event) => {
              event.preventDefault();
              setFromIndex(index, event.clipboardData.getData("text").replace(/[^A-Za-z0-9]/g, ""));
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !char && index > 0) refs.current[index - 1]?.focus();
              if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
              if (event.key === "ArrowRight" && index < length - 1) refs.current[index + 1]?.focus();
            }}
            className={cn(
              "h-12 w-10 rounded-md border bg-surface text-center text-[18px] font-semibold uppercase tabular text-ink outline-none transition-[border-color,box-shadow] duration-150 sm:w-11",
              "focus:border-brand focus:shadow-[0_0_0_3px_rgb(30_111_217/0.14)] disabled:bg-sunken",
              invalid ? "border-danger" : "border-line-strong",
            )}
          />
          {separatorAfter !== undefined && index === separatorAfter - 1 ? (
            <span aria-hidden className="text-lg font-semibold text-ink-4">
              –
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
