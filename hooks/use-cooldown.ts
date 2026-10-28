"use client";

import { useEffect, useState } from "react";

/** Countdown used to throttle "resend" actions (mobile useResendCooldown). */
export function useCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return { remaining, active: remaining > 0, start: () => setRemaining(seconds) };
}
