"use client";

import { CircleCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { PasswordStrength } from "@/components/forms/password-strength";
import { Alert } from "@/components/feedback/states";
import { Button, ButtonLink } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/controls";
import { PasswordField, TextField } from "@/components/ui/field";
import { useCooldown } from "@/hooks/use-cooldown";
import { forgotPasswordSchema, resetPasswordSchema, validate, verificationCodeSchema } from "@/lib/validation";
import * as authApi from "@/services/auth";

import { AuthFootnote, AuthHeading, TextLink } from "./auth-heading";

// Mobile flow: enterEmail → verify (6-digit code) → reset → passwordReset.
// Kept on one route so the email and code stay in memory, never in the URL.

const FALLBACK_EXPIRY_MS = 10 * 60 * 1000;

type Step = "email" | "code" | "reset" | "done";

function secondsUntil(iso: string) {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

export function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  if (step === "email") {
    return (
      <EmailStep
        email={email}
        setEmail={setEmail}
        onSent={(expiry) => {
          setExpiresAt(expiry ?? new Date(Date.now() + FALLBACK_EXPIRY_MS).toISOString());
          setStep("code");
        }}
      />
    );
  }
  if (step === "code") {
    return (
      <CodeStep
        email={email}
        expiresAt={expiresAt}
        setExpiresAt={setExpiresAt}
        onBack={() => setStep("email")}
        onVerified={(value) => {
          setCode(value);
          setStep("reset");
        }}
      />
    );
  }
  if (step === "reset") return <ResetStep email={email} code={code} onDone={() => setStep("done")} />;

  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-genuine-soft text-genuine">
        <CircleCheck className="size-6" />
      </div>
      <AuthHeading title="Password updated" description="Your password has been updated successfully. Sign in with your new password." />
      <ButtonLink href={`/sign-in?email=${encodeURIComponent(email)}`} size="lg" className="w-full">
        Back to sign in
      </ButtonLink>
    </div>
  );
}

function EmailStep({
  email,
  setEmail,
  onSent,
}: {
  email: string;
  setEmail: (value: string) => void;
  onSent: (expiresAt?: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(forgotPasswordSchema, { email });
    setFieldError(result.errors?.email);
    if (!result.data || sending) return;
    setSending(true);
    setError(null);
    const { implemented, expiresAt } = await authApi.forgotPassword(result.data.email);
    setSending(false);
    if (!implemented) {
      setError("Password recovery is temporarily unavailable. Please try again later.");
      return;
    }
    setEmail(result.data.email);
    onSent(expiresAt);
  };

  return (
    <>
      <AuthHeading
        title="Forgot your password?"
        description="Enter your email and we'll send you a 6-digit verification code."
        backHref="/sign-in"
        backLabel="Sign in"
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@institution.gov.ph"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError}
          autoFocus
        />
        <Button type="submit" size="lg" loading={sending} className="w-full">
          Send code
        </Button>
      </form>
      <AuthFootnote>
        Remember your password? <TextLink href="/sign-in">Sign in</TextLink>
      </AuthFootnote>
    </>
  );
}

function CodeStep({
  email,
  expiresAt,
  setExpiresAt,
  onBack,
  onVerified,
}: {
  email: string;
  expiresAt: string;
  setExpiresAt: (value: string) => void;
  onBack: () => void;
  onVerified: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [remaining, setRemaining] = useState(() => secondsUntil(expiresAt));
  const cooldown = useCooldown(5);

  useEffect(() => {
    const tick = () => setRemaining(secondsUntil(expiresAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(verificationCodeSchema, { code });
    if (!result.data) {
      setError(result.errors.code);
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      if (await authApi.verifyResetCode(email, result.data.code)) onVerified(result.data.code);
      else setError("That code is invalid or has expired. Please try again.");
    } catch {
      setError("Unable to verify the code right now. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (resending || cooldown.active) return;
    setResending(true);
    setError(null);
    const result = await authApi.forgotPassword(email);
    setResending(false);
    if (!result.implemented) {
      setError("Unable to resend the code right now. Please try again.");
      return;
    }
    setExpiresAt(result.expiresAt ?? new Date(Date.now() + FALLBACK_EXPIRY_MS).toISOString());
    setCode("");
    cooldown.start();
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <>
      <AuthHeading
        title="Enter verification code"
        description={
          <>
            We sent a 6-digit code to <span className="font-semibold text-ink">{email}</span>.
          </>
        }
      />
      <button type="button" onClick={onBack} className="-mt-5 mb-6 text-[13px] font-semibold text-brand hover:underline">
        Use a different email
      </button>
      <form onSubmit={verify} noValidate className="flex flex-col gap-5">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <CodeInput length={6} value={code} onChange={setCode} pattern={() => /[0-9]/} label="Verification code" invalid={Boolean(error)} />
        <p className="text-[13px] text-ink-3 tabular" aria-live="polite">
          {remaining > 0 ? `Code expires in ${minutes}:${seconds}` : "This code has expired. Request a new one."}
        </p>
        <Button type="submit" size="lg" loading={verifying} disabled={code.length !== 6} className="w-full">
          Verify code
        </Button>
        <Button variant="ghost" onClick={() => void resend()} loading={resending} disabled={cooldown.active}>
          {cooldown.active ? `Resend code (${cooldown.remaining}s)` : "Resend code"}
        </Button>
      </form>
    </>
  );
}

function ResetStep({ email, code, onDone }: { email: string; code: string; onDone: () => void }) {
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(resetPasswordSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword(email, code, result.data.password);
      onDone();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeading title="Set a new password" description="Choose a strong password you haven't used before." />
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex flex-col gap-2.5">
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            error={focused ? undefined : errors.password}
            autoFocus
          />
          {focused || errors.password ? <PasswordStrength password={values.password} /> : null}
        </div>
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) => setValues((current) => ({ ...current, confirmPassword: event.target.value }))}
          error={errors.confirmPassword}
        />
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Update password
        </Button>
      </form>
    </>
  );
}
