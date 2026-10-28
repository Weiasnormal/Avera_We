"use client";

import { ArrowRight, IdCardLanyard, FolderOpen, ClipboardPen, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/states";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import { StatCards, type StatCard } from "@/components/ui/stat-cards";
import { CaseTable } from "@/features/cases/case-table";
import { summarize } from "@/features/stats/compute";
import { useCases } from "@/hooks/use-cases";
import { formatRelativeTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminStore } from "@/stores/admin";
import { useSessionStore } from "@/stores/session";

import { MemberRequests } from "./member-requests";

/** Org Admin overview (mobile admin_dashboard.tsx). */
export function AdminDashboard() {
  const { cases, error, reload, isInitialLoading } = useCases();
  const members = useAdminStore((state) => state.members);
  const pending = useAdminStore((state) => state.pending);
  const tenant = useAdminStore((state) => state.tenant);
  const teamLoading = useAdminStore((state) => state.teamStatus === "idle" || state.teamStatus === "loading");
  const profile = useSessionStore((state) => state.profile);

  useEffect(() => {
    void useAdminStore.getState().loadTenant();
    void useAdminStore.getState().loadTeam();
  }, []);

  const summary = useMemo(() => summarize(cases), [cases]);
  const awaitingReview = useMemo(() => cases.filter((item) => item.workflowStatus === "PendingReview"), [cases]);
  const activeExaminers = members.filter((member) => member.status === "active").length;
  const topExaminers = useMemo(
    () => [...members].filter((member) => member.status === "active").sort((a, b) => b.casesHandled - a.casesHandled).slice(0, 5),
    [members],
  );

  const oldestWaiting = awaitingReview.reduce<string | null>(
    (oldest, item) => (!oldest || item.createdAt < oldest ? item.createdAt : oldest),
    null,
  );
  const decided = summary.genuine + summary.suspected;
  const [now] = useState(() => Date.now());
  const casesThisWeek = useMemo(() => cases.filter((item) => new Date(item.createdAt).getTime() >= now - 7 * 86_400_000).length, [cases, now]);

  // Same four figures, icons and order as the mobile admin home. Pending review is the admin's job, so it is
  // the one tinted card. The examiner card carries the org's seat limit.
  const seats =
    tenant && tenant.memberCountLimit > 0
      ? `${tenant.memberCount} of ${tenant.memberCountLimit} seats used`
      : `${activeExaminers} of ${members.length} examiners`;
  const stats: StatCard[] = [
    {
      label: "Active examiners",
      value: activeExaminers,
      meta: seats,
      icon: Users,
      tone: "brand",
      href: routes.admin.team,
      loading: teamLoading && members.length === 0,
    },
    {
      label: "Total cases",
      value: summary.total,
      meta: `${casesThisWeek} this week`,
      icon: FolderOpen,
      tone: "brand",
      href: routes.admin.cases,
      loading: isInitialLoading,
    },
    {
      label: "Pending review",
      value: summary.pendingReview,
      meta: oldestWaiting ? `Oldest waiting ${formatRelativeTime(oldestWaiting).replace(/ ago$/, "")}` : "Nothing waiting",
      icon: IdCardLanyard,
      tone: "pending",
      hero: summary.pendingReview > 0,
      href: `${routes.admin.cases}?filter=pending`,
      loading: isInitialLoading,
    },
    {
      label: "Suspected",
      value: summary.suspected,
      meta: decided ? `${Math.round((summary.suspected / decided) * 100)}% of verdicts` : undefined,
      icon: ClipboardPen,
      tone: "suspect",
      href: `${routes.admin.cases}?filter=suspected`,
      loading: isInitialLoading,
    },
  ];

  return (
    <>
      <PageHeader
        title={profile?.firstName ? `Welcome back, ${profile.firstName}` : tenant?.name || profile?.organization || "Overview"}
        description={
          isInitialLoading
            ? tenant?.name || profile?.organization || undefined
            : summary.pendingReview
              ? `${summary.pendingReview} case${summary.pendingReview === 1 ? " is" : "s are"} waiting for your review.`
              : "No cases are waiting for review."
        }
      />

      <StatCards className="mb-8" stats={stats} />

      {/* Four columns from xl: the side column is exactly one card wide, so its edges line up with the cards. */}
      <div className="grid gap-5 xl:grid-cols-4">
        <section className="min-w-0 xl:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Pending review</h2>
            <Link href={`${routes.admin.cases}?filter=pending`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
              All pending <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <CaseTable
            cases={awaitingReview}
            mode="admin"
            toolbar={false}
            limit={8}
            dateColumn="waiting"
            hrefFor={(item) => routes.admin.caseReview(item.caseId)}
            isLoading={isInitialLoading}
            error={error}
            onRetry={() => void reload()}
          />
        </section>

        <div className="flex flex-col gap-5">
          <Panel
            title="Member requests"
            description={pending.length ? `${pending.length} waiting for approval` : undefined}
            bodyClassName="p-0"
            actions={
              pending.length > 3 ? (
                <Link href={routes.admin.team} className="text-[13px] font-semibold text-brand hover:underline">
                  View all
                </Link>
              ) : undefined
            }
          >
            <MemberRequests limit={3} compact />
          </Panel>

          <Panel
            title="Top examiners"
            description="By cases handled"
            bodyClassName="p-0"
            actions={
              <Link href={routes.admin.team} className="text-[13px] font-semibold text-brand hover:underline">
                Manage
              </Link>
            }
          >
            {topExaminers.length === 0 && teamLoading ? (
              <ul className="divide-y divide-line" aria-busy aria-label="Loading team">
                {[0, 1, 2].map((row) => (
                  <li key={row} className="flex items-center gap-3 px-5 py-3">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-3.5 w-36" />
                  </li>
                ))}
              </ul>
            ) : topExaminers.length === 0 ? (
              <EmptyState compact title="No active examiners yet" description="Share your invite code to add examiners." />
            ) : (
              <ul className="divide-y divide-line">
                {topExaminers.map((member) => (
                  <li key={member.id}>
                    <Link href={routes.admin.member(member.id)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas">
                      <Avatar firstName={member.firstName} lastName={member.lastName} size={32} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                        {member.firstName} {member.lastName}
                      </span>
                      <span className="text-[13px] font-semibold text-ink-2 tabular" title={`${member.casesHandled} cases handled`}>
                        {member.casesHandled}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
