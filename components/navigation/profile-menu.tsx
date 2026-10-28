"use client";

import { LifeBuoy, LogOut, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import { Avatar } from "@/components/ui/avatar";
import { usePresence } from "@/hooks/use-presence";
import { cn } from "@/lib/cn";
import { profilePictureUrl } from "@/services/auth";
import { displayName, useSessionStore } from "@/stores/session";

const ROLE_LABEL = { user: "Forensic Document Examiner", admin: "Org Admin" } as const;

// Below Tailwind's `sm` breakpoint the menu opens as a bottom sheet (thumb reach,
// like the mobile app). The sheet is portaled to <body>: the header's
// backdrop-filter would otherwise trap `position: fixed` inside the header.
const PHONE_QUERY = "(max-width: 639px)";
const SHEET_EXIT_MS = 200;
// Swipe-down dismissal: far enough, or a quick flick regardless of distance.
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.11;

interface MenuLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Header avatar that opens the account menu (menu-button pattern): the
 * identity card on top, then Profile & settings, Help & support and Sign out.
 */
export function ProfileMenu({
  role,
  profileHref,
  helpHref,
  onSignOut,
}: {
  role: "user" | "admin";
  profileHref: string;
  helpHref: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const profile = useSessionStore((state) => state.profile);
  const claims = useSessionStore((state) => state.claims);
  const avatarVersion = useSessionStore((state) => state.avatarVersion);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startTime: number; dy: number } | null>(null);
  // Set when a swipe already carried the sheet off-screen, so the exit keyframe doesn't replay.
  const [swipedAway, setSwipedAway] = useState(false);
  const menuId = useId();
  const sheetPresence = usePresence(open && sheet, SHEET_EXIT_MS);

  const name = displayName(profile, claims?.email ?? "");
  const email = profile?.email ?? claims?.email ?? "";
  const avatarSrc = profilePictureUrl(avatarVersion);
  const links: MenuLink[] = [
    { href: profileHref, label: "Profile & settings", icon: UserRound },
    { href: helpHref, label: "Help & support", icon: LifeBuoy },
  ];

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const show = (focus?: "first" | "last") => {
    setSheet(window.matchMedia(PHONE_QUERY).matches);
    setSwipedAway(false);
    setOpen(true);
    if (!focus) return;
    // Focus after the menu mounts.
    requestAnimationFrame(() => {
      const list = items();
      (focus === "first" ? list[0] : list[list.length - 1])?.focus();
    });
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    // Crossing the breakpoint while open would leave the wrong presentation up.
    const query = window.matchMedia(PHONE_QUERY);
    const onBreakpoint = () => setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    query.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      query.removeEventListener("change", onBreakpoint);
    };
  }, [open]);

  // The sheet is modal on phones: keep the page underneath from scrolling.
  useEffect(() => {
    if (!open || !sheet) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, sheet]);

  const onDragStart = (event: ReactPointerEvent) => {
    if (drag.current || sheetPresence.closing) return; // ignore extra fingers
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startTime: performance.now(), dy: 0 };
    if (menuRef.current) menuRef.current.style.transition = "none";
  };

  const onDragMove = (event: ReactPointerEvent) => {
    const state = drag.current;
    const panel = menuRef.current;
    if (!state || !panel) return;
    const raw = event.clientY - state.startY;
    // Dragging up past the resting point meets friction instead of a hard stop.
    state.dy = raw > 0 ? raw : raw * 0.2;
    panel.style.transform = `translateY(${state.dy}px)`;
  };

  const onDragEnd = () => {
    const state = drag.current;
    const panel = menuRef.current;
    drag.current = null;
    if (!state || !panel) return;
    const velocity = state.dy / Math.max(1, performance.now() - state.startTime);
    panel.style.transition = `transform ${SHEET_EXIT_MS}ms var(--ease-out)`;
    if (state.dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      panel.style.transform = "translateY(100%)";
      setSwipedAway(true);
      close(true);
    } else {
      panel.style.transform = "";
    }
  };

  const onTriggerKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      show("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      show("last");
    }
  };

  const onMenuKey = (event: KeyboardEvent) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number> = {
      ArrowDown: (index + 1) % list.length,
      ArrowUp: (index - 1 + list.length) % list.length,
      Home: 0,
      End: list.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      list[moves[event.key]]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      close();
    }
  };

  // Bigger touch targets in the sheet.
  const itemClass = cn(
    "flex w-full items-center gap-3 rounded-md px-3 text-left font-medium outline-none transition-colors duration-150",
    sheet ? "h-12 text-[15px]" : "h-10 text-[13.5px]",
  );

  const identity = (
    <div className={cn("flex items-center gap-3 border-b border-line bg-canvas", sheet ? "px-5 pt-2 pb-4" : "px-4 py-4")}>
      <Avatar src={avatarSrc} firstName={profile?.firstName} lastName={profile?.lastName} size={sheet ? 52 : 44} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-ink">{name}</p>
        {email && email !== name ? <p className="truncate text-[12.5px] text-ink-3">{email}</p> : null}
        <p className="mt-1 inline-flex rounded-full bg-brand-soft px-2 py-px text-[11px] font-semibold text-brand-strong">
          {ROLE_LABEL[role]}
        </p>
      </div>
    </div>
  );

  const actions = (
    <>
      <div className="p-1.5">
        {links.map(({ href, label, icon: Icon }) => {
          const current = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              role="menuitem"
              aria-current={current ? "page" : undefined}
              onClick={() => close()}
              className={cn(
                itemClass,
                current ? "bg-sunken text-ink" : "text-ink-2 hover:bg-sunken hover:text-ink focus-visible:bg-sunken focus-visible:text-ink",
              )}
            >
              <Icon aria-hidden className={cn("size-4", current ? "text-brand" : "text-ink-3")} />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-line p-1.5">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            close();
            onSignOut();
          }}
          className={cn(itemClass, "text-danger hover:bg-danger-soft focus-visible:bg-danger-soft")}
        >
          <LogOut aria-hidden className="size-4" />
          Sign out
        </button>
      </div>
    </>
  );

  const menuProps = { ref: menuRef, id: menuId, role: "menu", "aria-label": "Account", onKeyDown: onMenuKey };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${name || "your account"}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onTriggerKey}
        className={cn("pressable flex size-10 items-center justify-center rounded-full", open ? "bg-brand-soft" : "hover:bg-sunken")}
      >
        <Avatar
          src={avatarSrc}
          firstName={profile?.firstName}
          lastName={profile?.lastName}
          size={32}
          className={cn("ring-2 transition-shadow duration-150", open ? "ring-brand" : "ring-transparent")}
        />
      </button>

      {open && !sheet ? (
        <div
          {...menuProps}
          className="absolute top-full right-0 z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-lg border border-line bg-surface shadow-pop animate-popover-in"
        >
          {identity}
          {actions}
        </div>
      ) : null}

      {sheetPresence.mounted && sheet
        ? createPortal(
            <div className={cn("fixed inset-0 z-50", sheetPresence.closing && "pointer-events-none")}>
              <div
                aria-hidden
                className={cn("absolute inset-0 bg-ink/40", sheetPresence.closing ? "animate-fade-out" : "animate-fade-in")}
                onClick={() => close(true)}
              />
              <div
                {...menuProps}
                className={cn(
                  "absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-xl bg-surface pb-[max(12px,env(safe-area-inset-bottom))] shadow-pop",
                  sheetPresence.closing ? (swipedAway ? "" : "animate-sheet-out") : "animate-sheet-in",
                )}
              >
                {/* Grab area: the handle and identity header can be swiped down to dismiss. */}
                <div
                  className="touch-none select-none"
                  onPointerDown={onDragStart}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                  onPointerCancel={onDragEnd}
                >
                  <div aria-hidden className="flex cursor-grab justify-center bg-canvas pt-2.5 pb-1">
                    <span className="h-1 w-10 rounded-full bg-line-strong" />
                  </div>
                  {identity}
                </div>
                {actions}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
