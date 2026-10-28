import Image from "next/image";
import Link from "next/link";

// Shared frame for sign-in, registration, verification, recovery and the
// organization onboarding steps.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(380px,0.85fr)_1.15fr]">
      <aside className="relative hidden overflow-hidden bg-brand text-white lg:flex lg:flex-col">
        <div className="relative z-10 flex flex-1 flex-col px-12 py-10">
          <Link href="/sign-in" className="flex items-center gap-3 self-start">
            <Image src="/brand/avera-logo.webp" alt="" width={40} height={40} priority />
            <span className="text-[20px] font-bold tracking-[-0.01em]">Avera</span>
          </Link>
          <div className="mt-auto max-w-100">
            <p className="text-[30px] leading-[1.15] font-bold tracking-[-0.02em]">
              Signature verification, with the evidence in view.
            </p>
            <p className="mt-4 text-[14.5px] leading-relaxed text-white/80">
              Compare a questioned signature against four references, review the model&apos;s verdict alongside its
              Grad-CAM evidence, and keep every decision inside your organization.
            </p>
          </div>
          <p className="mt-10 text-[12px] text-white/65">
            Avera is a decision-support tool. Results must be reviewed by a qualified forensic document examiner.
          </p>
        </div>
        {/* The mark, enlarged and cropped, as the panel's only ornament. */}
        <Image
          src="/brand/avera-logo.webp"
          alt=""
          width={560}
          height={560}
          aria-hidden
          className="pointer-events-none absolute -right-40 -bottom-24 w-[560px] opacity-[0.09]"
        />
      </aside>

      <main className="flex min-h-dvh flex-col bg-surface">
        <div className="flex items-center gap-2.5 px-5 pt-6 lg:hidden">
          <Image src="/brand/avera-icon.png" alt="" width={30} height={30} className="rounded-[8px]" />
          <span className="text-[17px] font-bold">Avera</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[420px] animate-rise-in">{children}</div>
        </div>
      </main>
    </div>
  );
}
