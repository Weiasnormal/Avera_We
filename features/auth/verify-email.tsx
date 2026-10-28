"use client";

import { CircleCheck, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/feedback/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCooldown } from "@/hooks/use-cooldown";
import * as authApi from "@/services/auth";
import { toast } from "@/stores/toast";

import { AuthFootnote, AuthHeading, TextLink } from "./auth-heading";

const STEPS = ["Check your email inbox", "Open the verification link", "Sign in to continue"];

type LinkState = "idle" | "verifying" | "verified" | "failed";

/**
 * Two jobs, as in the mobile app: the "check your inbox" instructions after
 * sign-up, and the landing page for the emailed link
 * (/verify-email?userId=…&token=…[&type=change-email&email=…&newEmail=…]).
 */
export function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const userId = params.get("userId");
  const type = params.get("type") ?? undefined;
  const email = params.get("email") ?? "";
  const newEmail = params.get("newEmail") ?? undefined;
  const isLink = Boolean(token || userId);
  const isEmailChange = type?.toLowerCase() === "change-email";

  const [linkState, setLinkState] = useState<LinkState>(isLink ? "verifying" : "idle");
  const [resending, setResending] = useState(false);
  const cooldown = useCooldown(5);
  const handled = useRef(false);

  useEffect(() => {
    if (!isLink || handled.current) return;
    handled.current = true;
    if (!token?.trim() || !userId?.trim()) {
      queueMicrotask(() => setLinkState("failed"));
      return;
    }
    void (async () => {
      const ok = await authApi.verifyEmailToken(userId, token, { type, email: email || undefined, newEmail });
      setLinkState(ok ? "verified" : "failed");
      if (!ok) return;
      toast.success("Email verified");
      if (isEmailChange) {
        // The email on the session changed: sign out and sign in with the new address.
        await authApi.logout();
        router.replace(`/sign-in?email=${encodeURIComponent(newEmail ?? email)}`);
      }
    })();
  }, [email, isEmailChange, isLink, newEmail, router, token, type, userId]);

  const resend = async () => {
    if (!email || cooldown.active || resending) return;
    setResending(true);
    cooldown.start();
    const { ok, message } = await authApi.resendVerificationEmail(email);
    setResending(false);
    if (ok) toast.success("Verification email resent");
    else toast.info(message ?? "Unable to resend right now");
  };

  const signInHref = `/sign-in${email ? `?email=${encodeURIComponent(newEmail ?? email)}` : ""}`;

  if (linkState === "verifying") {
    return (
      <div className="flex flex-col items-center py-10 text-center" aria-live="polite">
        <Spinner className="size-7 text-brand" />
        <p className="mt-4 text-[15px] font-semibold">Verifying your email…</p>
      </div>
    );
  }

  if (linkState === "verified") {
    return (
      <div className="text-center" aria-live="polite">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-genuine-soft text-genuine">
          <CircleCheck className="size-6" />
        </div>
        <AuthHeading
          title="Email verified"
          description={
            isEmailChange
              ? "Your email address has been updated. Sign in with your new email."
              : "Your account is ready. Sign in to join your organization."
          }
        />
        <ButtonLink href={signInHref} size="lg" className="w-full">
          Continue to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Mail className="size-6" />
      </div>
      <AuthHeading
        title="Verify your email"
        description={
          <>
            We sent a verification link to <span className="font-semibold text-ink">{email || "your email"}</span>.
          </>
        }
      />

      {linkState === "failed" ? (
        <Alert tone="error" title="Verification issue" className="mb-6">
          This verification link has expired or is invalid. Request a new one.
        </Alert>
      ) : null}

      <ol className="mb-8 flex flex-col gap-3">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-3 text-[14px] text-ink-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-[12px] font-bold text-ink-2 tabular">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <Button
        size="lg"
        className="w-full"
        onClick={() => void resend()}
        disabled={!email || cooldown.active}
        loading={resending}
      >
        {resending ? "Resending…" : cooldown.active ? `Resend email (${cooldown.remaining}s)` : "Resend email"}
      </Button>

      <AuthFootnote>
        Already verified? <TextLink href={signInHref}>Sign in</TextLink>
      </AuthFootnote>
    </>
  );
}
