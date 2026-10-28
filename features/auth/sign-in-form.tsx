"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { hasSupportedRole } from "@/lib/jwt";
import { homePathFor, onboardingPathFor, safeNextPath } from "@/lib/routes";
import { signInSchema, validate } from "@/lib/validation";
import * as authApi from "@/services/auth";
import { toast } from "@/stores/toast";

import { AuthFootnote, AuthHeading, TextLink } from "./auth-heading";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const result = validate(signInSchema, { email, password });
    setErrors(result.errors ?? {});
    if (!result.data) return;

    setSubmitting(true);
    setFormError(null);
    setNeedsVerification(false);
    try {
      const session = await authApi.login(result.data.email, result.data.password);
      if (!session.userId || !hasSupportedRole(session.roles)) {
        await authApi.logout();
        setFormError("This account does not have access to Avera.");
        return;
      }
      if (!session.tenantId) {
        router.replace(onboardingPathFor(session.role));
        return;
      }
      const next = safeNextPath(params.get("next"));
      const nextFitsRole = next && (session.role === "admin" ? next.startsWith("/admin") : !next.startsWith("/admin"));
      router.replace(nextFitsRole ? next : homePathFor(session.role));
      router.refresh();
    } catch (error) {
      setNeedsVerification(authApi.isEmailVerificationRequired(error));
      setFormError(error instanceof Error && error.message ? error.message : "Unable to sign in. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    const value = email.trim();
    if (!value || resending) return;
    setResending(true);
    const { ok } = await authApi.resendVerificationEmail(value);
    setResending(false);
    if (ok) toast.success("Verification email sent");
    else toast.info("Unable to send verification email");
    router.push(`/verify-email?email=${encodeURIComponent(value)}`);
  };

  return (
    <>
      <AuthHeading title="Sign in" description="Use the email and password for your Avera account." />

      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {formError ? (
          <Alert
            tone="error"
            action={
              needsVerification ? (
                <Button size="sm" variant="secondary" loading={resending} onClick={() => void resendVerification()}>
                  Verify email
                </Button>
              ) : undefined
            }
          >
            {formError}
          </Alert>
        ) : null}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@institution.gov.ph"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          autoFocus={!email}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoFocus={Boolean(email)}
          trailing={<TextLink href="/forgot-password">Forgot password?</TextLink>}
        />

        <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <AuthFootnote>
        New to Avera? <TextLink href="/sign-up">Create an account</TextLink>
      </AuthFootnote>
    </>
  );
}
