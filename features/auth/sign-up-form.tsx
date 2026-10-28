"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PasswordStrength } from "@/components/forms/password-strength";
import { Alert } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { PasswordField, TextField } from "@/components/ui/field";
import type { AppRole } from "@/lib/routes";
import { signUpSchema, validate } from "@/lib/validation";
import * as authApi from "@/services/auth";

import { AuthFootnote, AuthHeading, TextLink } from "./auth-heading";

const ROLE_COPY: Record<AppRole, { subtitle: string; placeholder: string }> = {
  user: {
    subtitle: "Joining as a Forensic Document Examiner. You'll join your organization with an invite code after verifying your email.",
    placeholder: "user@institution.gov.ph",
  },
  admin: {
    subtitle: "Joining as an Org Admin. You'll set up your organization after verifying your email.",
    placeholder: "admin@institution.gov.ph",
  },
};

export function SignUpForm() {
  const router = useRouter();
  const [role, setRole] = useState<AppRole>("user");
  const [values, setValues] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const result = validate(signUpSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return;

    const input: authApi.RegisterInput = {
      firstName: result.data.firstName,
      lastName: result.data.lastName,
      email: result.data.email,
      password: result.data.password,
      role: role === "admin" ? "Admin" : "User",
    };
    const verifyHref = `/verify-email?email=${encodeURIComponent(input.email)}&role=${role}`;

    setSubmitting(true);
    setFormError(null);
    try {
      await authApi.register(input);
      router.push(verifyHref);
    } catch (error) {
      // An unverified account with this email may already exist: resend the link and continue.
      if (await authApi.resumeUnverifiedRegistration(input, error).catch(() => false)) {
        router.push(verifyHref);
        return;
      }
      setFormError(
        authApi.normalizeAuthErrorMessage(error instanceof Error ? error.message : error, input.email) ||
          "Unable to create your account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const showStrength = passwordFocused || (values.password.length > 0 && Boolean(errors.password));

  return (
    <>
      <AuthHeading title="Create your account" description={ROLE_COPY[role].subtitle} />

      <Segmented
        label="Account type"
        value={role}
        onChange={setRole}
        className="mb-6 w-full"
        options={[
          { value: "user", label: "Document Examiner" },
          { value: "admin", label: "Org Admin" },
        ]}
      />

      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="First name" autoComplete="given-name" value={values.firstName} onChange={set("firstName")} error={errors.firstName} />
          <TextField label="Last name" autoComplete="family-name" value={values.lastName} onChange={set("lastName")} error={errors.lastName} />
        </div>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder={ROLE_COPY[role].placeholder}
          value={values.email}
          onChange={set("email")}
          error={errors.email}
        />
        <div className="flex flex-col gap-2.5">
          <PasswordField
            label="Password"
            autoComplete="new-password"
            value={values.password}
            onChange={set("password")}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            error={passwordFocused ? undefined : errors.password}
          />
          {showStrength ? <PasswordStrength password={values.password} /> : null}
        </div>
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={set("confirmPassword")}
          error={errors.confirmPassword}
        />

        <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <AuthFootnote>
        Already have an account? <TextLink href="/sign-in">Sign in</TextLink>
      </AuthFootnote>
    </>
  );
}
