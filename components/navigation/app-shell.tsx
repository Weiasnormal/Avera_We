"use client";

import {
  BarChart3,
  Building2,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/modals/confirm-dialog";
import { resetUserState } from "@/components/providers/session-provider";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { profilePictureUrl } from "@/services/auth";
import { useAdminStore } from "@/stores/admin";
import { displayName, useSessionStore } from "@/stores/session";

import { NotificationBell } from "./notification-bell";
import { NewAnalysisButton } from "./new-analysis-button";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
}

const ROLE_LABEL = { user: "Forensic Document Examiner", admin: "Org Admin" } as const;

function useNavItems(role: "user" | "admin"): NavItem[] {
  const pendingCount = useAdminStore((state) => state.pending.length);
  if (role === "admin") {
    return [
      { href: routes.admin.dashboard, label: "Overview", icon: LayoutDashboard, exact: true },
      { href: routes.admin.cases, label: "Cases", icon: FolderOpen },
      { href: routes.admin.team, label: "Team", icon: Users, badge: pendingCount },
      { href: routes.admin.stats, label: "Statistics", icon: BarChart3 },
      { href: routes.admin.organization, label: "Organization", icon: Building2 },
    ];
  }
  return [
    { href: routes.examiner.dashboard, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: routes.examiner.cases, label: "Cases", icon: FolderOpen },
    { href: routes.examiner.stats, label: "Statistics", icon: BarChart3 },
  ];
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] font-medium transition-colors duration-150",
        active ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:bg-surface/70 hover:text-ink",
      )}
    >
      <Icon className={cn("size-4.25", active ? "text-brand" : "text-ink-3 group-hover:text-ink-2")} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white tabular">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AppShell({ role, children }: { role: "user" | "admin"; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = useNavItems(role);
  const profile = useSessionStore((state) => state.profile);
  const claims = useSessionStore((state) => state.claims);
  const avatarVersion = useSessionStore((state) => state.avatarVersion);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const profileHref = role === "admin" ? routes.admin.profile : routes.examiner.profile;
  const helpHref = role === "admin" ? routes.admin.help : routes.examiner.help;

  useEffect(() => {
    if (role === "admin") void useAdminStore.getState().loadTeam();
  }, [role]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const signOut = async () => {
    setSigningOut(true);
    await useSessionStore.getState().signOut();
    resetUserState();
    router.replace(routes.signIn);
  };

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Image src="/brand/avera-icon.png" alt="" width={28} height={28} className="rounded-[7px]" priority />
        <span className="text-[17px] font-bold tracking-[-0.01em] text-ink">Avera</span>
      </div>

      <div className="px-3 pb-2 text-[12px] text-ink-3">
        {/* Fixed line height so the nav below doesn't jump when the profile arrives. */}
        {profile ? (
          <p className="h-[18px] truncate px-2 font-medium text-ink-2" title={profile.organization}>
            {profile.organization || "Organization unavailable"}
          </p>
        ) : (
          <div className="flex h-[18px] items-center px-2">
            <Skeleton className="h-3 w-36" />
          </div>
        )}
      </div>

      {role === "user" ? (
        <div className="px-3 pb-4 pt-1">
          <NewAnalysisButton className="w-full" onNavigate={onNavigate} />
        </div>
      ) : null}

      <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
        {items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-3">
        <NavLink item={{ href: helpHref, label: "Help & support", icon: LifeBuoy }} pathname={pathname} onNavigate={onNavigate} />
        <NavLink item={{ href: profileHref, label: "Profile & settings", icon: UserRound }} pathname={pathname} onNavigate={onNavigate} />
        <div className="mt-2 flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
          <Avatar
            src={profilePictureUrl(avatarVersion)}
            firstName={profile?.firstName}
            lastName={profile?.lastName}
            size={34}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{displayName(profile, claims?.email ?? "")}</p>
            <p className="truncate text-[11.5px] text-ink-3">{ROLE_LABEL[role]}</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            aria-label="Sign out"
            title="Sign out"
            className="pressable flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-62 border-r border-line bg-rail lg:block">{sidebar()}</aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-70 max-w-[85vw] border-r border-line bg-rail shadow-pop animate-[drawer-in_260ms_var(--ease-drawer)]">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-sunken"
            >
              <X className="size-4" />
            </button>
            {sidebar(() => setDrawerOpen(false))}
          </aside>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-canvas/90 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="pressable -ml-1 flex size-10 items-center justify-center rounded-md text-ink-2 hover:bg-sunken lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <Link href={role === "admin" ? routes.admin.dashboard : routes.examiner.dashboard} className="flex items-center gap-2 lg:hidden">
          <Image src="/brand/avera-icon.png" alt="" width={24} height={24} className="rounded-sm" />
          <span className="text-[15px] font-bold">Avera</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-320 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>

      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={signOut}
        loading={signingOut}
        title="Sign out of Avera?"
        description="You will need to sign in again to access your cases."
        confirmLabel="Sign out"
      />
    </div>
  );
}
