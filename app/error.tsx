"use client";

import { Button } from "@/components/ui/button";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-[22px] font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-[44ch] text-[14px] text-ink-3">An unexpected error interrupted this page. Your data has not been changed.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
