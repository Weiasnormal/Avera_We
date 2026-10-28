// Text helpers ported from the mobile app's utils (validation.ts, timeElapsed.ts).

export function normalizePersonName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase()
    .split(/([\s.'-]+)/)
    .map((part) => (/^[a-z]/.test(part) ? `${part[0].toLocaleUpperCase()}${part.slice(1)}` : part))
    .join("");
}

export function normalizePersonDisplay(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes("@") ? trimmed : normalizePersonName(trimmed);
}

export const INVITE_CODE_PATTERN = /^[A-Z]{3}[A-Z0-9]{4}$/;

/** "abc1x2y" / "ABC-1X2Y" → "ABC-1X2Y", or null when invalid. */
export function normalizeInviteCode(value: string): string | null {
  const compact = value.trim().toUpperCase().replace(/-/g, "");
  if (!INVITE_CODE_PATTERN.test(compact)) return null;
  return `${compact.slice(0, 3)}-${compact.slice(3)}`;
}

/** Parses .NET TimeSpan strings ("d.hh:mm:ss.fffffff") or milliseconds. */
export function parseTimeElapsedMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) return null;
  const [, days = "0", hours, minutes, seconds, fraction] = match;
  const totalSeconds =
    ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 +
    Number(seconds) +
    (fraction ? Number(`0.${fraction}`) : 0);
  return Math.max(0, totalSeconds * 1000);
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "—";
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", options ?? { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  return formatDate(value, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** "3 days ago" style label (mobile adminStore.formatRelativeTime). */
export function formatRelativeTime(dateIso: string | null): string {
  if (!dateIso) return "Recently";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "Recently";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

export function initials(firstName?: string, lastName?: string, fallback = "?") {
  const value = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return value || fallback;
}

/** Strips characters that are invalid in file names (mobile getReportCaseIdentifier). */
export function safeFileSegment(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}
