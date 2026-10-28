"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function Avatar({
  src,
  firstName,
  lastName,
  size = 36,
  className,
}: {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand-strong",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials(firstName, lastName)}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated proxy image
        <img
          src={src!}
          alt=""
          onError={() => setFailedSrc(src!)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}
