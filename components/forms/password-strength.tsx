import { Check } from "lucide-react";

import { cn } from "@/lib/cn";
import { getPasswordStrength } from "@/lib/validation";

const BAR_COLORS = ["#F05B57", "#F2903D", "#E9B949", "#82C365", "#2E9F5C"];

/** Strength meter and checklist (mobile PasswordStrengthGuide). */
export function PasswordStrength({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const filled = strength.metChecks === 0 ? 0 : Math.min(strength.metChecks, 4);
  const color = BAR_COLORS[Math.max(0, strength.metChecks - 1)];

  return (
    <div className="rounded-md border border-line bg-canvas px-3.5 py-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
          {Array.from({ length: 4 }, (_, index) => (
            <span
              key={index}
              className="h-1 rounded-full bg-line-strong transition-colors duration-200"
              style={index < filled ? { backgroundColor: color } : undefined}
            />
          ))}
        </div>
        <span className="w-14 text-right text-[12px] font-semibold" style={{ color: password ? color : undefined }}>
          {password ? strength.label : ""}
        </span>
      </div>
      <ul className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {strength.requirements.map((rule) => (
          <li key={rule.label} className={cn("flex items-center gap-1.5 text-[12.5px]", rule.met ? "text-genuine" : "text-ink-3")}>
            <Check className={cn("size-3.5", !rule.met && "opacity-30")} aria-hidden />
            <span>{rule.label}</span>
            <span className="sr-only">{rule.met ? "(met)" : "(not met)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
