"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { EmptyState } from "@/components/feedback/states";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import { CaseTable } from "@/features/cases/case-table";
import { summarize } from "@/features/stats/compute";
import { useCases } from "@/hooks/use-cases";
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

  const stats: { label: string; value: number; tone?: string }[] = [
    { label: "Awaiting review", value: summary.pendingReview },
    { label: "Total cases", value: summary.total },
    { label: "Suspected", value: summary.suspected, tone: "text-suspect" },
    { label: "Active examiners", value: activeExaminers },
  ];

  return (
    <>
      <PageHeader
        title={tenant?.name || profile?.organization || "Overview"}
        description={profile?.firstName ? `Signed in as ${profile.firstName} ${profile.lastName} · Org Admin` : "Org Admin"}
      />

      <dl className="mb-8 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface shadow-card lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`border-line px-5 py-4 ${index % 2 ? "border-l" : ""} ${index >= 2 ? "border-t lg:border-t-0" : ""} ${index === 2 ? "lg:border-l" : ""}`}
          >
            <dt className="text-[12.5px] font-medium text-ink-3">{stat.label}</dt>
            <dd className={`mt-1 text-[22px] font-bold tabular ${stat.tone ?? "text-ink"}`}>
              {isInitialLoading ? <Skeleton className="mt-1 h-6 w-10" /> : stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section>
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
            hrefFor={(item) => routes.admin.caseReview(item.caseId)}
            isLoading={isInitialLoading}
            error={error}
            onRetry={() => void reload()}
          />
        </section>

        <div className="flex flex-col gap-6">
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

          <Panel title="Team overview" description="Active examiners by cases handled" bodyClassName="p-0">
            {topExaminers.length === 0 ? (
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
                      <span className="text-[12.5px] text-ink-3 tabular">
                        {member.casesHandled} case{member.casesHandled === 1 ? "" : "s"}
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
