import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-strong disabled:bg-brand/45 shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_1px_2px_rgb(30_111_217/0.25)]",
  secondary:
    "bg-surface text-ink border border-line-strong hover:border-ink-4 hover:bg-canvas disabled:text-ink-4 disabled:bg-surface",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink disabled:text-ink-4",
  danger: "bg-danger text-white hover:bg-[#c02f2e] disabled:bg-danger/45",
  "danger-ghost": "text-danger hover:bg-danger-soft disabled:text-danger/50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-sm",
  md: "h-10 px-4 text-sm gap-2 rounded-md",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-md",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "pressable inline-flex shrink-0 select-none items-center justify-center font-semibold whitespace-nowrap",
    "disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({ variant = "primary", size = "md", icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

interface IconButtonProps extends ComponentProps<"button"> {
  label: string;
  size?: "sm" | "md";
}

export function IconButton({ label, size = "md", className, children, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "pressable inline-flex items-center justify-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "size-8" : "size-10",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
