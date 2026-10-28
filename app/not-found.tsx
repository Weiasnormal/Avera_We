import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[13px] font-semibold text-ink-3">404</p>
      <h1 className="mt-2 text-[24px] font-bold">This page doesn&apos;t exist</h1>
      <p className="mt-2 max-w-[44ch] text-[14px] text-ink-3">Check the address, or head back to your dashboard.</p>
      <ButtonLink href="/" className="mt-6">
        Go to dashboard
      </ButtonLink>
    </main>
  );
}
