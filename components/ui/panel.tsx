import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Bordered surface section. One level only — never nest panels. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = "section",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={cn("rounded-lg border border-line bg-surface shadow-card", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-semibold text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-ink-3">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </Tag>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {back ? <div className="mb-3">{back}</div> : null}
        <h1 className="text-[24px] leading-tight font-bold tracking-[-0.015em] text-ink">{title}</h1>
        {description ? <p className="mt-1.5 max-w-[68ch] text-[14px] text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Label/value pair for detail grids. */
export function Fact({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[12px] font-medium text-ink-3">{label}</dt>
      <dd className="mt-1 truncate text-[14px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
