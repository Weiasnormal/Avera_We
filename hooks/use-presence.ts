"use client";

import { useEffect, useState } from "react";

/**
 * Keeps an element mounted for `exitMs` after `open` turns false so it can play
 * an exit animation. `closing` is true during that window.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  // Mount in the same render that opens (derived state, no extra paint).
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, mounted, exitMs]);

  return { mounted: open || mounted, closing: !open && mounted };
}
