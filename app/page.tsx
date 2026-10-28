import { redirect } from "next/navigation";
import { Suspense } from "react";

import { homePathFor, onboardingPathFor } from "@/lib/routes";
import { readSession } from "@/lib/server/session";

// proxy.ts normally redirects "/" before this renders; this is the fallback.
async function RedirectHome(): Promise<null> {
  const session = await readSession();
  if (!session) redirect("/sign-in");
  redirect(session.tenantId ? homePathFor(session.role) : onboardingPathFor(session.role));
}

export default function Home() {
  return (
    <Suspense>
      <RedirectHome />
    </Suspense>
  );
}
