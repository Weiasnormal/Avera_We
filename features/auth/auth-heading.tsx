import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthHeading({
  title,
  description,
  backHref,
  backLabel = "Back",
}: {
  title: string;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-8">
      {backHref ? (
        <Link
          href={backHref}
          className="-ml-1.5 mb-6 inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[13px] font-medium text-ink-3 hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink">{title}</h1>
      {description ? <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{description}</p> : null}
    </div>
  );
}

export function AuthFootnote({ children }: { children: ReactNode }) {
  return <p className="mt-8 text-center text-[13.5px] text-ink-3">{children}</p>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand hover:underline">
      {children}
    </Link>
  );
}
