"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Select } from "./select";

const CONTROL =
  "w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-4 " +
  "transition-[border-color,box-shadow] duration-150 outline-none " +
  "focus:border-brand focus:shadow-[0_0_0_3px_rgb(30_111_217/0.14)] " +
  "disabled:bg-sunken disabled:text-ink-3";

function borderFor(error?: string) {
  return error ? "border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgb(217_58_57/0.14)]" : "border-line-strong";
}

interface FieldShellProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
  trailing?: ReactNode;
}

export function FieldShell({ label, htmlFor, error, hint, optional, children, className, trailing }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
          {label}
          {optional ? <span className="ml-1 font-normal text-ink-4">(optional)</span> : null}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[12.5px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[12.5px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  trailing?: ReactNode;
  id?: string;
}

export function TextField({ label, error, hint, optional, trailing, className, id, ...props }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional} trailing={trailing} className={className}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(CONTROL, "h-10", borderFor(error))}
        {...props}
      />
    </FieldShell>
  );
}

export function PasswordField({ label, error, hint, trailing, className, id, ...props }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell label={label} htmlFor={fieldId} error={error} hint={hint} trailing={trailing} className={className}>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(CONTROL, "h-10 pr-11", borderFor(error))}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-ink-4 hover:text-ink-2"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<ComponentProps<"textarea">, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  trailing?: ReactNode;
}

export function TextAreaField({ label, error, hint, optional, trailing, className, ...props }: TextAreaFieldProps) {
  const fieldId = useId();
  return (
    <FieldShell label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional} trailing={trailing} className={className}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, "min-h-28 resize-y py-2.5 leading-relaxed", borderFor(error))}
        {...props}
      />
    </FieldShell>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
}

/** Labeled form dropdown on the shared custom Select (native popups can't be styled). */
export function SelectField<T extends string>({ label, value, options, onChange, error, disabled, className }: SelectFieldProps<T>) {
  const fieldId = useId();
  return (
    <FieldShell label={label} htmlFor={fieldId} error={error} className={className}>
      <Select
        id={fieldId}
        variant="field"
        value={value}
        options={options.map((option) => ({ value: option, label: option }))}
        onChange={onChange}
        invalid={Boolean(error)}
        describedBy={error ? `${fieldId}-error` : undefined}
        disabled={disabled}
      />
    </FieldShell>
  );
}
