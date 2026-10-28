"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/feedback/states";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { useAdminStore } from "@/stores/admin";

/** Pending join requests with approve / decline (mobile admin_member_request_card). */
export function MemberRequests({ limit, compact }: { limit?: number; compact?: boolean }) {
  const pending = useAdminStore((state) => state.pending);
  const tenant = useAdminStore((state) => state.tenant);
  const teamStatus = useAdminStore((state) => state.teamStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const seatsFull = tenant ? tenant.memberCountLimit > 0 && tenant.memberCount >= tenant.memberCountLimit : false;
  const shown = limit ? pending.slice(0, limit) : pending;

  const act = async (id: string, action: "approve" | "reject") => {
    setBusy(`${action}:${id}`);
    await useAdminStore.getState()[action](id);
    setBusy(null);
  };

  // Until the first load finishes, an empty list would wrongly read as "no requests".
  if (pending.length === 0 && (teamStatus === "idle" || teamStatus === "loading")) {
    return (
      <ul className="divide-y divide-line" aria-busy aria-label="Loading member requests">
        {[0, 1].map((row) => (
          <li key={row} className="flex items-center gap-3 px-5 py-3.5">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (pending.length === 0) {
    return (
      <EmptyState
        compact
        illustration={compact ? undefined : "/illustrations/member_request.png"}
        title="No pending requests"
        description="Examiners who enter your invite code appear here for approval."
      />
    );
  }

  return (
    <>
      {seatsFull ? (
        <p className="border-b border-line bg-caution-soft px-5 py-2.5 text-[12.5px] text-[#7c3a0a]">
          No seats left, approvals paused. Raise the member limit under Organization.
        </p>
      ) : null}
      {/* Container query: in the narrow overview column the actions drop under the name. */}
      <ul className="@container divide-y divide-line">
        {shown.map((request) => (
          <li
            key={request.id}
            className={cn("flex flex-wrap items-center gap-y-2.5", compact ? "gap-x-2.5 px-4 py-3" : "gap-x-3 px-5 py-3.5")}
          >
            <Avatar firstName={request.firstName} lastName={request.lastName} size={compact ? 32 : 36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink" title={`${request.firstName} ${request.lastName}`}>
                {request.firstName} {request.lastName}
              </p>
              <p className="truncate text-[12.5px] text-ink-3">
                {compact ? "" : "Requested "}
                {formatRelativeTime(request.requestedAt)}
              </p>
            </div>
            {compact ? (
              // Narrow overview column: round icon actions, as on the mobile admin home.
              <div className="flex shrink-0 gap-1.5">
                <IconAction
                  label={`Decline ${request.firstName} ${request.lastName}`}
                  tone="decline"
                  loading={busy === `reject:${request.id}`}
                  disabled={busy !== null}
                  onClick={() => void act(request.id, "reject")}
                />
                <IconAction
                  label={seatsFull ? "No seats left" : `Approve ${request.firstName} ${request.lastName}`}
                  tone="approve"
                  loading={busy === `approve:${request.id}`}
                  disabled={busy !== null || seatsFull}
                  onClick={() => void act(request.id, "approve")}
                />
              </div>
            ) : (
              <div className="flex w-full gap-2 pl-12 @md:w-auto @md:pl-0">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<X className="size-3.5" />}
                  loading={busy === `reject:${request.id}`}
                  disabled={busy !== null}
                  onClick={() => void act(request.id, "reject")}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  icon={<Check className="size-3.5" />}
                  loading={busy === `approve:${request.id}`}
                  disabled={busy !== null || seatsFull}
                  onClick={() => void act(request.id, "approve")}
                >
                  Approve
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function IconAction({
  label,
  tone,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  tone: "approve" | "decline";
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = loading ? LoaderCircle : tone === "approve" ? Check : X;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "pressable flex size-8 items-center justify-center rounded-full border bg-surface disabled:cursor-not-allowed disabled:opacity-50",
        tone === "approve"
          ? "border-genuine-line text-genuine hover:bg-genuine-soft"
          : "border-suspect-line text-suspect hover:bg-suspect-soft",
      )}
    >
      <Icon aria-hidden className={cn("size-4", loading && "animate-spin")} strokeWidth={2.25} />
    </button>
  );
}
