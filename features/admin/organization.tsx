"use client";

import { Copy, Pencil, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState, type FormEvent } from "react";

import { LoadError } from "@/components/feedback/states";
import { LimitDialog } from "@/components/modals/limit-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { Fact, PageHeader, Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { fetchInviteCode } from "@/services/admin";
import { useAdminStore } from "@/stores/admin";
import { toast } from "@/stores/toast";

const MAX_MEMBERS = 99;
const WARN_RATIO = 0.8;

/** Mobile OrganizationScreen + OrgInviteCodeScreen + member_limit modal. */
export function Organization() {
  const tenant = useAdminStore((state) => state.tenant);
  const tenantStatus = useAdminStore((state) => state.tenantStatus);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"rename" | "limit" | null>(null);

  useEffect(() => {
    void useAdminStore.getState().loadTenant();
    fetchInviteCode()
      .then(setInviteCode)
      .catch((error) => setInviteError(error instanceof Error ? error.message : "Unable to load the invite code."));
  }, []);

  const code = inviteCode ?? tenant?.inviteCode ?? null;

  if (tenantStatus === "error" && !tenant) {
    return <LoadError message="Unable to load your organization." onRetry={() => void useAdminStore.getState().loadTenant()} />;
  }

  const used = tenant?.memberCount ?? 0;
  const limit = tenant?.memberCountLimit ?? 0;
  const level = limit <= 0 || used >= limit ? "full" : used / limit >= WARN_RATIO ? "warn" : "ok";
  const seatsLeft = Math.max(limit - used, 0);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Invite code copied");
    } catch {
      toast.error("Unable to copy. Select the code and copy it manually.");
    }
  };

  const share = async () => {
    if (!code) return;
    const text = `Join our organization on Avera using invite code: ${code}`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(text).then(
        () => toast.success("Invite message copied"),
        () => toast.error("Unable to share code"),
      );
    }
  };

  return (
    <>
      <PageHeader title="Organization" description="Your organization profile, member seats and invite code." />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Panel
            title="Profile"
            actions={
              <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setDialog("rename")} disabled={!tenant}>
                Rename
              </Button>
            }
          >
            {tenant ? (
              <dl className="grid gap-5 sm:grid-cols-3">
                <Fact label="Name" value={tenant.name || "—"} />
                <Fact label="Members" value={<span className="tabular">{tenant.memberCount}</span>} />
                <Fact label="Created" value={formatDate(tenant.createdAt)} />
              </dl>
            ) : (
              <Skeleton className="h-12 w-full" />
            )}
          </Panel>

          <Panel
            title="Member seats"
            actions={
              <Button size="sm" variant="secondary" onClick={() => setDialog("limit")} disabled={!tenant}>
                Change limit
              </Button>
            }
          >
            {tenant ? (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[22px] font-bold tabular">
                    {used} <span className="text-[15px] font-medium text-ink-3">of {limit} seats used</span>
                  </p>
                  <p className={cn("text-[13px] font-semibold", level === "full" ? "text-danger" : level === "warn" ? "text-caution" : "text-ink-3")}>
                    {seatsLeft === 0 ? "No seats left, approvals paused" : `${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left`}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500 ease-out",
                      level === "full" ? "bg-danger" : level === "warn" ? "bg-caution" : "bg-brand",
                    )}
                    style={{ width: `${limit > 0 ? Math.min(used / limit, 1) * 100 : 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <Skeleton className="h-12 w-full" />
            )}
          </Panel>
        </div>

        <Panel title="Invite code" description="Examiners enter this code after signing up to request access.">
          {code ? (
            <div className="flex flex-col items-center gap-5">
              <div className="rounded-lg border border-line bg-white p-4">
                <QRCodeSVG value={code} size={168} fgColor="#0f172a" marginSize={0} title={`QR code for invite code ${code}`} />
              </div>
              <p className="text-[28px] font-bold tracking-[0.08em] tabular select-all">{code}</p>
              <div className="grid w-full grid-cols-2 gap-2">
                <Button variant="secondary" icon={<Copy className="size-4" />} onClick={() => void copy()}>
                  Copy code
                </Button>
                <Button variant="secondary" icon={<Share2 className="size-4" />} onClick={() => void share()}>
                  Share
                </Button>
              </div>
            </div>
          ) : inviteError ? (
            <p className="text-[13.5px] text-danger">{inviteError}</p>
          ) : (
            <Skeleton className="mx-auto h-56 w-48" />
          )}
        </Panel>
      </div>

      <RenameDialog open={dialog === "rename"} onClose={() => setDialog(null)} current={tenant?.name ?? ""} />
      <LimitDialog
        open={dialog === "limit"}
        onClose={() => setDialog(null)}
        title="Member limit"
        description="The maximum number of members in your organization. It can't be lower than the current member count."
        initial={Math.min(MAX_MEMBERS, Math.max(limit, used))}
        min={Math.max(1, used)}
        max={MAX_MEMBERS}
        unit="Members"
        onSave={(value) => useAdminStore.getState().setMemberLimit(value)}
      />
    </>
  );
}

function RenameDialog({ open, onClose, current }: { open: boolean; onClose: () => void; current: string }) {
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);
  if (open && !seeded) {
    setSeeded(true);
    setName(current);
  }
  if (!open && seeded) setSeeded(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || name.trim() === current || saving) return;
    setSaving(true);
    const ok = await useAdminStore.getState().rename(name);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} dismissible={!saving} size="sm" title="Rename organization" description="Members see the new name right away.">
      <form onSubmit={submit} className="flex flex-col gap-4 pb-4">
        <TextField label="Organization name" value={name} onChange={(event) => setName(event.target.value)} autoFocus maxLength={120} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim() || name.trim() === current}>
            Save name
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
