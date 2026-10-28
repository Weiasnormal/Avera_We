"use client";

import { Bell, Camera, KeyRound, LayoutGrid, Mail, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ConfirmDialog, TypeToConfirmDialog } from "@/components/modals/confirm-dialog";
import { resetUserState } from "@/components/providers/session-provider";
import { Alert } from "@/components/feedback/states";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { TextField } from "@/components/ui/field";
import { PageHeader, Panel } from "@/components/ui/panel";
import { DEFAULT_VIEW_PREF } from "@/features/results/evidence-viewer";
import { notificationsEnabled, notificationsSupported, setNotificationsEnabled } from "@/lib/browser-notifications";
import { ImageValidationError, decodeImage, toPng, validateImageFile } from "@/lib/image";
import { readPreference, writePreference } from "@/lib/preferences";
import { profileNameSchema, validate } from "@/lib/validation";
import * as authApi from "@/services/auth";
import { displayName, useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";
import { RESULT_VIEW_MODES, type ResultViewMode } from "@/types/case";

import { ChangeEmailDialog, ChangePasswordDialog } from "./account-dialogs";

const ROLE_LABEL = { user: "Forensic Document Examiner", admin: "Org Admin" } as const;

const DELETE_COPY = {
  user: {
    title: "Delete your account?",
    message: "This action cannot be undone. All your personal data and account history will be permanently deleted from Avera.",
  },
  admin: {
    title: "Delete your Avera Admin account?",
    message: "This action cannot be undone. You will permanently lose admin access to Avera and all associated account data.",
  },
};

/** Square center crop for the profile picture (mobile picker used a 1:1 editor). */
async function squareAvatar(file: File) {
  const bitmap = await decodeImage(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const crop = {
    x: (bitmap.width - side) / 2 / bitmap.width,
    y: (bitmap.height - side) / 2 / bitmap.height,
    width: side / bitmap.width,
    height: side / bitmap.height,
  };
  bitmap.close();
  return toPng(file, crop);
}

export function ProfilePage({ role }: { role: "user" | "admin" }) {
  const router = useRouter();
  const profile = useSessionStore((state) => state.profile);
  const profileError = useSessionStore((state) => state.profileError);
  const claims = useSessionStore((state) => state.claims);
  const avatarVersion = useSessionStore((state) => state.avatarVersion);

  const [names, setNames] = useState({ firstName: "", lastName: "" });
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  const [avatar, setAvatar] = useState<{ blob: Blob; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"email" | "password" | "delete" | "delete-type" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [defaultView, setDefaultView] = useState<ResultViewMode>("Heatmap");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    // Sync the form with the loaded profile.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNames({ firstName: profile.firstName, lastName: profile.lastName });
  }, [profile]);

  useEffect(() => {
    // Browser-only preferences are read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotifications(notificationsEnabled());
    setDefaultView(readPreference<ResultViewMode>(DEFAULT_VIEW_PREF, "Heatmap"));
  }, []);

  useEffect(() => () => {
    if (avatar) URL.revokeObjectURL(avatar.url);
  }, [avatar]);

  const dirty =
    Boolean(avatar) || (profile !== null && (names.firstName !== profile.firstName || names.lastName !== profile.lastName));

  const pickAvatar = async (file: File) => {
    try {
      validateImageFile(file);
      const blob = await squareAvatar(file);
      setAvatar({ blob, url: URL.createObjectURL(blob) });
    } catch (error) {
      toast.error(error instanceof ImageValidationError ? error.message : "Unable to use this image. Please try another.");
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const result = validate(profileNameSchema, names);
    setNameErrors(result.errors ?? {});
    if (!result.data || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (profile && (result.data.firstName !== profile.firstName || result.data.lastName !== profile.lastName)) {
        await authApi.changeName(result.data.firstName, result.data.lastName);
      }
      if (avatar) {
        await authApi.uploadProfilePicture(avatar.blob, "profile-picture.png");
        useSessionStore.getState().bumpAvatar();
        setAvatar(null);
      }
      await useSessionStore.getState().loadProfile();
      toast.success("Profile updated successfully");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save your profile changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    setNotifications(value);
    const granted = await setNotificationsEnabled(value);
    if (value && !granted) {
      setNotifications(false);
      toast.info("Allow notifications for this site in your browser settings to receive alerts.");
      return;
    }
    toast.success(value ? "Notifications enabled" : "Notifications disabled");
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      resetUserState();
      toast.success("Your account has been deleted.");
      router.replace("/sign-in");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete your account. Please try again.");
      setDeleting(false);
      setDialog(null);
    }
  };

  const email = profile?.email || claims?.email || "";

  return (
    <>
      <PageHeader title="Profile & settings" description="Manage your account details, security and preferences." />

      {profileError && !profile ? (
        <Alert tone="error" className="mb-6">
          {profileError}
        </Alert>
      ) : null}

      <div className="grid max-w-[880px] gap-6">
        <Panel title="Personal details">
          <form onSubmit={save} className="flex flex-col gap-6" noValidate>
            {saveError ? <Alert tone="error">{saveError}</Alert> : null}
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative">
                <Avatar
                  src={avatar?.url ?? authApi.profilePictureUrl(avatarVersion)}
                  firstName={profile?.firstName}
                  lastName={profile?.lastName}
                  size={72}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Change profile picture"
                  className="pressable absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-surface bg-brand text-white shadow-card hover:bg-brand-strong"
                >
                  <Camera className="size-3.5" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void pickAvatar(file);
                  }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[17px] font-bold text-ink">{displayName(profile, email)}</p>
                <p className="text-[13px] text-ink-3">{ROLE_LABEL[role]}</p>
                <p className="text-[13px] text-ink-3">{profile?.organization || "Organization unavailable"}</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="First name"
                autoComplete="given-name"
                value={names.firstName}
                onChange={(event) => setNames((current) => ({ ...current, firstName: event.target.value }))}
                error={nameErrors.firstName}
              />
              <TextField
                label="Last name"
                autoComplete="family-name"
                value={names.lastName}
                onChange={(event) => setNames((current) => ({ ...current, lastName: event.target.value }))}
                error={nameErrors.lastName}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-line pt-5">
              {dirty ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAvatar(null);
                    if (profile) setNames({ firstName: profile.firstName, lastName: profile.lastName });
                  }}
                  disabled={saving}
                >
                  Discard changes
                </Button>
              ) : null}
              <Button type="submit" disabled={!dirty} loading={saving}>
                Save changes
              </Button>
            </div>
          </form>
        </Panel>

        <Panel title="Sign-in & security" bodyClassName="divide-y divide-line py-1">
          <SettingsRow icon={<Mail className="size-4" />} title="Email" detail={email} action={<Button variant="secondary" size="sm" onClick={() => setDialog("email")}>Change</Button>} />
          <SettingsRow
            icon={<KeyRound className="size-4" />}
            title="Password"
            detail="Changing it signs you out of this session."
            action={<Button variant="secondary" size="sm" onClick={() => setDialog("password")}>Change</Button>}
          />
        </Panel>

        <Panel title="Preferences" bodyClassName="divide-y divide-line py-1">
          <Switch
            icon={<Bell className="size-4" />}
            label="Browser notifications"
            description={
              notificationsSupported()
                ? "Alert me when an analysis finishes while Avera is in a background tab."
                : "This browser does not support notifications."
            }
            checked={notifications}
            onChange={(value) => void toggleNotifications(value)}
            disabled={!notificationsSupported()}
          />
          {role === "user" ? (
            <SettingsRow
              icon={<LayoutGrid className="size-4" />}
              title="Default result view"
              detail="The evidence view shown first when you open a result."
              action={
                <select
                  aria-label="Default result view"
                  value={defaultView}
                  onChange={(event) => {
                    const value = event.target.value as ResultViewMode;
                    setDefaultView(value);
                    writePreference(DEFAULT_VIEW_PREF, value);
                    toast.success(`Default view set to ${value}`);
                  }}
                  className="h-8 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium outline-none focus:border-brand"
                >
                  {RESULT_VIEW_MODES.map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              }
            />
          ) : null}
        </Panel>

        <Panel title="Delete account" className="border-suspect-line">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-[56ch] text-[13.5px] text-ink-3">{DELETE_COPY[role].message}</p>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setDialog("delete")}>
              Delete account
            </Button>
          </div>
        </Panel>
      </div>

      <ChangeEmailDialog open={dialog === "email"} onClose={() => setDialog(null)} currentEmail={email} />
      <ChangePasswordDialog open={dialog === "password"} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={() => setDialog("delete-type")}
        tone="danger"
        title={DELETE_COPY[role].title}
        description={DELETE_COPY[role].message}
        confirmLabel="Continue"
      />
      <TypeToConfirmDialog
        open={dialog === "delete-type"}
        onClose={() => setDialog(null)}
        onConfirm={deleteAccount}
        loading={deleting}
        phrase="DELETE"
        title="Confirm account deletion"
        description="This permanently deletes your Avera account."
        confirmLabel="Delete account"
      />
    </>
  );
}

function SettingsRow({ icon, title, detail, action }: { icon: React.ReactNode; title: string; detail?: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-2">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        {detail ? <p className="truncate text-[13px] text-ink-3">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}
