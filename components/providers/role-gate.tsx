import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/navigation/app-shell";
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

function ShellFallback() {
  return (
    <div className="min-h-dvh lg:pl-[248px]" aria-busy>
      <div className="fixed inset-y-0 left-0 hidden w-[248px] border-r border-line bg-rail lg:block" />
      <div className="h-16 border-b border-line" />
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
