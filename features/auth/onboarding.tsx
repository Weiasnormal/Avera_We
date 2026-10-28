"use client";

import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/controls";
import { TextField } from "@/components/ui/field";
import { inviteCodeSchema, validate } from "@/lib/validation";
import * as adminApi from "@/services/admin";
import * as authApi from "@/services/auth";
import { fetchNotifications } from "@/services/notifications";
import { toast } from "@/stores/toast";

import { AuthHeading } from "./auth-heading";

function SignOutLink() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <p className="mt-8 text-center text-[13.5px] text-ink-3">
      Signed in with the wrong account?{" "}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await authApi.logout();
          router.replace("/sign-in");
        }}
        className="font-semibold text-brand hover:underline disabled:text-ink-4"
      >
        Sign out
      </button>
    </p>
  );
}

// --- Examiner: join with an invite code (mobile User&AdminCodepage) ---------

export function JoinOrganization() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(inviteCodeSchema, { code });
    if (!result.data) {
      setError(result.errors.code);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const raw = result.data.code;
      const session = await authApi.joinInviteCode(`${raw.slice(0, 3)}-${raw.slice(3, 7)}`);
      if (session?.tenantId) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        router.replace("/pending");
      }
    } catch (joinError) {
      setError(authApi.normalizeInviteCodeErrorMessage(joinError instanceof Error ? joinError.message : joinError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeading
        title="Join your organization"
        description="Enter the invite code your organization admin gave you. It looks like ABC-1X2Y."
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <CodeInput
          length={7}
          value={code}
          onChange={setCode}
          separatorAfter={3}
          label="Invite code"
          invalid={Boolean(error)}
          pattern={(index) => (index < 3 ? /[A-Za-z]/ : /[A-Za-z0-9]/)}
        />
        <p className="text-[13px] text-ink-3">You can paste the whole code into the first box. No code yet? Ask your organization admin.</p>
        <Button type="submit" size="lg" loading={submitting} disabled={code.length !== 7} className="w-full">
          Request to join
        </Button>
      </form>
      <SignOutLink />
    </>
  );
}

// --- Examiner: waiting for approval (mobile PendingUser&Admin) --------------

const APPROVAL_POLL_MS = 10_000;

export function PendingApproval() {
  const router = useRouter();
  const handled = useRef(false);

  const handleApproved = useCallback(async () => {
    if (handled.current) return;
    handled.current = true;
    // The current token was issued before approval and has no TenantId claim;
    // a fresh sign-in issues one that does (mobile re-logs in the same way).
    let email = "";
    try {
      email = (await authApi.fetchSession())?.email ?? "";
    } catch {
      email = "";
    }
    await authApi.logout();
    toast.success("Your organization request was approved. Please sign in.");
    router.replace(`/sign-in${email ? `?email=${encodeURIComponent(email)}` : ""}`);
  }, [router]);

  useEffect(() => {
    const check = async () => {
      try {
        const notifications = await fetchNotifications();
        const approval = notifications.find((item) =>
          /approved|accepted/i.test(`${item.type} ${item.title} ${item.message}`),
        );
        if (approval) await handleApproved();
      } catch {
        // Keep waiting; the next poll retries.
      }
    };
    void check();
    const timer = setInterval(() => void check(), APPROVAL_POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [handleApproved]);

  return (
    <>
      <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-caution-soft text-caution">
        <Clock className="size-6" />
      </div>
      <AuthHeading
        title="Request pending approval"
        description="Your registration is under review. You'll receive an email once your organization admin approves it."
      />
      <ol className="flex flex-col gap-3">
        {["Admin reviews your request", "You receive an approval email", "Sign in to access your dashboard"].map((step, index) => (
          <li key={step} className="flex items-center gap-3 text-[14px] text-ink-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-[12px] font-bold tabular">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[13px] text-ink-3" aria-live="polite">
        This page checks for approval automatically.
      </p>
      <SignOutLink />
    </>
  );
}

// --- Admin: create the organization (mobile OrganizationCreate) -------------

export function CreateOrganization() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Organization name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await adminApi.createTenant(trimmed);
      if (!session?.tenantId) throw new Error("Create tenant response did not include an access token");
      router.replace("/admin");
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create organization.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeading
        title="Set up your organization"
        description="Name the organization your examiners will join. You can rename it later."
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <TextField
          label="Organization name"
          placeholder="e.g. NBI Questioned Documents Division"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          maxLength={120}
        />
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Create organization
        </Button>
      </form>
      <SignOutLink />
    </>
  );
}
