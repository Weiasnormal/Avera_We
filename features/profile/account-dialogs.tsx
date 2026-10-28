"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PasswordStrength } from "@/components/forms/password-strength";
import { Alert } from "@/components/feedback/states";
import { resetUserState } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PasswordField, TextField } from "@/components/ui/field";
import { useCooldown } from "@/hooks/use-cooldown";
import { changePasswordSchema, validate } from "@/lib/validation";
import * as authApi from "@/services/auth";
import { toast } from "@/stores/toast";

/** Mobile change_email + change_email_success: request a verified email change. */
export function ChangeEmailDialog({ open, onClose, currentEmail }: { open: boolean; onClose: () => void; currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const cooldown = useCooldown(5);

  const canSend = /\S+@\S+\.\S+/.test(newEmail) && newEmail.trim().toLowerCase() !== currentEmail.trim().toLowerCase() && password.length > 0;

  const close = () => {
    setNewEmail("");
    setPassword("");
    setError(null);
    setSentTo(null);
    onClose();
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend || sending) return;
    setSending(true);
    setError(null);
    const result = await authApi.requestEmailChange(newEmail.trim(), password);
    setSending(false);
    if (!result.ok) {
      setError(result.message ?? "Unable to request an email change.");
      return;
    }
    setPassword("");
    setSentTo(newEmail.trim());
  };

  const resend = async () => {
    if (!sentTo || cooldown.active) return;
    cooldown.start();
    const result = await authApi.resendEmailChangeVerification(currentEmail, sentTo);
    if (result.ok) toast.success("Verification email resent");
    else toast.info(result.message ?? "Unable to resend right now");
  };

  if (sentTo) {
    return (
      <Dialog
        open={open}
        onClose={close}
        size="sm"
        icon={<MailCheck className="size-[18px]" />}
        title="Check your new inbox"
        description={
          <>
            We sent a verification link to <strong className="text-ink">{sentTo}</strong>. Your email changes once you open it,
            and you&apos;ll be asked to sign in again.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => void resend()} disabled={cooldown.active}>
              {cooldown.active ? `Resend (${cooldown.remaining}s)` : "Resend link"}
            </Button>
            <Button onClick={close}>Done</Button>
          </>
        }
      />
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!sending}
      size="sm"
      title="Change email"
      description="We'll send a verification link to your new address."
    >
      <form onSubmit={send} className="flex flex-col gap-4 pb-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <TextField label="Current email" value={currentEmail} disabled readOnly />
        <TextField label="New email" type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} autoFocus />
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Required to confirm it's you."
        />
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={sending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSend} loading={sending}>
            Send verification link
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Mobile ChangePasswordScreen: on success the session ends and the user signs in again. */
export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setValues({ currentPassword: "", password: "", confirmPassword: "" });
    setErrors({});
    setError(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(changePasswordSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data || saving) return;
    setSaving(true);
    setError(null);
    try {
      await authApi.changePassword(result.data.currentPassword, result.data.password);
      await authApi.logout();
      resetUserState();
      toast.success("Password changed. Sign in with your new password.");
      router.replace("/sign-in");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "Unable to change password.");
      setSaving(false);
    }
  };

  const set = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Dialog open={open} onClose={close} dismissible={!saving} size="sm" title="Change password" description="You'll be signed out and asked to sign in with the new password.">
      <form onSubmit={submit} className="flex flex-col gap-4 pb-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <PasswordField label="Current password" autoComplete="current-password" value={values.currentPassword} onChange={set("currentPassword")} error={errors.currentPassword} autoFocus />
        <div className="flex flex-col gap-2.5">
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={values.password}
            onChange={set("password")}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            error={focused ? undefined : errors.password}
          />
          {focused || errors.password ? <PasswordStrength password={values.password} /> : null}
        </div>
        <PasswordField label="Confirm new password" autoComplete="new-password" value={values.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Change password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
