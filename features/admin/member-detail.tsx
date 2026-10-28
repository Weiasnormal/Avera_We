"use client";

import { ArrowLeft, Ban, CalendarClock, FolderOpen, UserMinus, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { LoadError } from "@/components/feedback/states";
import { ConfirmDialog, TypeToConfirmDialog } from "@/components/modals/confirm-dialog";
import { LimitDialog } from "@/components/modals/limit-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import { useCases } from "@/hooks/use-cases";
import { routes } from "@/lib/routes";
import * as adminApi from "@/services/admin";
import type { TenantMemberDetail } from "@/services/admin";
import { useAdminStore } from "@/stores/admin";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

const MAX_DAILY_LIMIT = 99;

/** Mobile MemberDetailsScreen: case history, daily limit, suspend, remove. */
export function MemberDetail({ memberId }: { memberId: string }) {
  const router = useRouter();
  const tenantId = useSessionStore((state) => state.claims?.tenantId ?? "");
  const { cases } = useCases();
  const [member, setMember] = useState<TenantMemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"limit" | "suspend" | "remove" | "remove-type" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMember(await adminApi.fetchMember(memberId, tenantId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load member");
    }
  }, [memberId, tenantId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void useAdminStore.getState().loadTeam();
  }, [load]);

  if (error && !member) return <LoadError message={error} onRetry={() => void load()} />;
  if (!member) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full max-w-[760px] rounded-lg" />
      </div>
    );
  }

  const name = `${member.firstName} ${member.lastName}`.trim() || member.email;
  const isProtected = /admin/i.test(member.role);
  const caseCount = cases.filter((item) => item.ownerUserId?.toLowerCase() === memberId.toLowerCase()).length;

  const toggleSuspend = async () => {
    setBusy(true);
    // The store only acts on members in the loaded team list (tenant guard).
    if (!useAdminStore.getState().members.some((item) => item.id === memberId)) await useAdminStore.getState().loadTeam();
    const known = useAdminStore.getState().members.some((item) => item.id === memberId);
    let ok = false;
    if (known) {
      ok = await useAdminStore.getState().setSuspended(memberId, !member.isSuspended);
    } else {
      toast.info("Member is outside your organization");
    }
    setBusy(false);
    setDialog(null);
    if (ok) setMember({ ...member, isSuspended: !member.isSuspended });
  };

  const remove = async () => {
    setBusy(true);
    const ok = await useAdminStore.getState().remove(memberId);
    setBusy(false);
    setDialog(null);
    if (ok) router.replace(routes.admin.team);
  };

  return (
    <>
      <PageHeader
        back={
          <Link href={routes.admin.team} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
            <ArrowLeft className="size-4" /> Team
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name}
            {member.isSuspended ? <Badge tone="suspect">Suspended</Badge> : <Badge tone="genuine">Active</Badge>}
          </span>
        }
        description={member.email}
      />

      <div className="grid max-w-[760px] gap-6">
        <Panel>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar firstName={member.firstName} lastName={member.lastName} size={52} />
            <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[12px] text-ink-3">Role</dt>
                <dd className="mt-0.5 text-[14px] font-semibold">{isProtected ? "Org Admin" : "Forensic Document Examiner"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-3">Cases</dt>
                <dd className="mt-0.5 text-[14px] font-semibold tabular">{caseCount}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-3">Daily case limit</dt>
                <dd className="mt-0.5 text-[14px] font-semibold tabular">{member.dailyCaseLimit ?? "No limit"}</dd>
              </div>
            </dl>
          </div>
        </Panel>

        <Panel title="Access" bodyClassName="divide-y divide-line py-1">
          <ActionRow
            icon={<FolderOpen className="size-4" />}
            title="Case history"
            detail={`${caseCount} case${caseCount === 1 ? "" : "s"} in your organization`}
            action={
              <ButtonLink href={`${routes.admin.cases}?examiner=${encodeURIComponent(memberId)}`} variant="secondary" size="sm">
                View cases
              </ButtonLink>
            }
          />
          <ActionRow
            icon={<CalendarClock className="size-4" />}
            title="Daily case limit"
            detail="Maximum new cases this examiner can create per day."
            action={
              <Button variant="secondary" size="sm" onClick={() => setDialog("limit")} disabled={isProtected}>
                {member.dailyCaseLimit === null ? "Set limit" : "Change"}
              </Button>
            }
          />
          <ActionRow
            icon={member.isSuspended ? <UserRoundCheck className="size-4" /> : <Ban className="size-4" />}
            title={member.isSuspended ? "Unsuspend examiner" : "Suspend examiner"}
            detail={member.isSuspended ? "Restore access to Avera." : "Temporarily block sign-in and new cases."}
            action={
              <Button variant={member.isSuspended ? "secondary" : "danger-ghost"} size="sm" onClick={() => setDialog("suspend")} disabled={isProtected}>
                {member.isSuspended ? "Unsuspend" : "Suspend"}
              </Button>
            }
          />
          {!isProtected ? (
            <ActionRow
              icon={<UserMinus className="size-4" />}
              title="Remove from organization"
              detail="Permanently remove access."
              action={
                <Button variant="danger-ghost" size="sm" onClick={() => setDialog("remove")}>
                  Remove
                </Button>
              }
            />
          ) : null}
        </Panel>
      </div>

      <LimitDialog
        open={dialog === "limit"}
        onClose={() => setDialog(null)}
        title="Daily case limit"
        description={`How many new cases ${name} can create each day.`}
        initial={Math.min(MAX_DAILY_LIMIT, Math.max(1, member.dailyCaseLimit ?? 1))}
        min={1}
        max={MAX_DAILY_LIMIT}
        unit="Cases per day"
        onSave={async (value) => {
          try {
            const saved = await adminApi.setDailyCaseLimit(memberId, value);
            setMember({ ...member, dailyCaseLimit: saved });
            toast.success(`Daily case limit set to ${saved}`);
            return true;
          } catch {
            toast.error("Unable to update daily case limit. Try again.");
            return false;
          }
        }}
      />
      <ConfirmDialog
        open={dialog === "suspend"}
        onClose={() => setDialog(null)}
        onConfirm={toggleSuspend}
        loading={busy}
        tone={member.isSuspended ? "default" : "danger"}
        title={member.isSuspended ? "Unsuspend examiner?" : "Suspend examiner?"}
        description={
          member.isSuspended
            ? `${name} will be able to sign in and create cases again.`
            : `${name} will be signed out and won't be able to access Avera until unsuspended.`
        }
        confirmLabel={member.isSuspended ? "Unsuspend" : "Suspend"}
      />
      <ConfirmDialog
        open={dialog === "remove"}
        onClose={() => setDialog(null)}
        onConfirm={() => setDialog("remove-type")}
        tone="danger"
        title={`Remove ${name} from the organization?`}
        description="They will lose access to your organization's cases."
        confirmLabel="Continue"
      />
      <TypeToConfirmDialog
        open={dialog === "remove-type"}
        onClose={() => setDialog(null)}
        onConfirm={remove}
        loading={busy}
        phrase="REMOVE"
        title="Confirm removal"
        description="This permanently removes this member."
        confirmLabel="Remove"
      />
    </>
  );
}

function ActionRow({ icon, title, detail, action }: { icon: React.ReactNode; title: string; detail: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-2">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="text-[13px] text-ink-3">{detail}</p>
      </div>
      {action}
    </div>
  );
}
