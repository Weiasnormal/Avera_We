"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type BackendNotification,
} from "@/services/notifications";
import { onHubEvent } from "@/services/realtime";

const POLL_MS = 60_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = items.filter((item) => !item.isRead).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchNotifications());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch; state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const events = ["NewCaseResult", "CaseReviewCompleted", "CaseFlagged", "MemberRequestCreated", "TenantRenamed"] as const;
    const unsubscribers = events.map((event) => onHubEvent(event, () => void load()));
    return () => {
      clearInterval(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (item: BackendNotification) => {
    if (item.isRead || busyId) return;
    setBusyId(item.id);
    try {
      await markNotificationAsRead(item.id);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
    } catch {
      setError("Unable to update the notification.");
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    setBusyId("all");
    try {
      await markAllNotificationsAsRead();
      setItems((current) => current.map((entry) => ({ ...entry, isRead: true })));
    } catch {
      setError("Unable to mark notifications as read.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
        className="pressable relative flex size-10 items-center justify-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink"
      >
        <Bell className="size-4.5" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white tabular">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-50 origin-top-right rounded-lg border border-line bg-surface shadow-pop animate-rise-in sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-95"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-[14px] font-semibold">Notifications</p>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={unread === 0 || busyId !== null}
              className="flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-[12.5px] font-semibold text-brand hover:bg-brand-soft disabled:text-ink-4 disabled:hover:bg-transparent"
            >
              {busyId === "all" ? <Spinner className="size-3.5" /> : <CheckCheck className="size-3.5" />}
              Mark all read
            </button>
          </div>
          <div className="max-h-[min(60dvh,440px)] overflow-y-auto">
            {error ? <p className="px-4 py-3 text-[13px] text-danger">{error}</p> : null}
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-10 text-ink-4">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-ink-3">You&apos;re all caught up.</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void markRead(item)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas",
                        !item.isRead && "bg-brand-soft/40",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.isRead ? "bg-transparent" : "bg-brand")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-ink">{item.title || item.type}</span>
                        {item.message ? <span className="mt-0.5 block text-[13px] text-ink-2">{item.message}</span> : null}
                        <span className="mt-1 block text-[12px] text-ink-4">{formatRelativeTime(item.createdAt)}</span>
                      </span>
                      {busyId === item.id ? <Spinner className="size-3.5 text-ink-4" /> : null}
                      <span className="sr-only">{item.isRead ? "Read" : "Unread — select to mark as read"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
