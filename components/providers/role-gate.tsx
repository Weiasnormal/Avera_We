import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/navigation/app-shell";
import { Skeleton } from "@/components/ui/spinner";
import { homePathFor, onboardingPathFor, type AppRole } from "@/lib/routes";
import { readSession } from "@/lib/server/session";

import { RealtimeListener } from "./realtime-listener";
import { SessionProvider } from "./session-provider";

// Server-side role check for an app area. proxy.ts already redirects, this keeps
// the area correct even if the proxy matcher changes. Reading the cookie is
// request-time data, so it streams inside <Suspense> (Cache Components).

async function Gate({ role, children }: { role: AppRole; children: ReactNode }) {
  const session = await readSession();
  if (!session) redirect(role === "admin" ? "/sign-in?next=/admin" : "/sign-in");
  if (!session.tenantId) redirect(onboardingPathFor(session.role));
  if (session.role !== role) redirect(homePathFor(session.role));

  return (
    <SessionProvider claims={session} fallback={<ShellFallback />}>
      <RealtimeListener role={role} />
      <AppShell role={role}>{children}</AppShell>
    </SessionProvider>
  );
}

// Mirrors the AppShell frame (rail, brand, top bar, page heading) so the first
// paint already looks like the app instead of an empty page while it loads.
function ShellFallback() {
  // Same shape as AppShell's Brand: logo, name, organization line.
  const brand = (
    <>
      <Image src="/brand/avera-icon.png" alt="" width={32} height={32} className="rounded-lg" priority />
      <span className="flex flex-col">
        <span className="text-[16px] leading-tight font-bold tracking-[-0.01em] text-ink">Avera</span>
        <span className="flex h-4 items-center">
          <Skeleton className="h-2.5 w-24" />
        </span>
      </span>
    </>
  );
  return (
    <div className="min-h-dvh lg:pl-[248px]" aria-busy aria-label="Loading Avera">
      <div className="fixed inset-y-0 left-0 hidden w-62 border-r border-line bg-rail lg:block">
        <div className="flex h-16 items-center gap-2.5 px-5">{brand}</div>
        <div className="flex flex-col gap-3.5 px-5 pt-1">
          <Skeleton className="h-15 w-full rounded-xl" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="flex h-16 items-center gap-2.5 border-b border-line px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5 pl-11 lg:hidden">{brand}</div>
        <div className="ml-auto flex items-center gap-1.5">
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-360 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        <Skeleton className="mt-8 h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function RoleGate({ role, children }: { role: AppRole; children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Gate role={role}>{children}</Gate>
    </Suspense>
  );
}
