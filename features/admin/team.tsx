"use client";

import { ChevronRight, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, LoadError } from "@/components/feedback/states";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/spinner";
import { routes } from "@/lib/routes";
import { useAdminStore } from "@/stores/admin";

import { MemberRequests } from "./member-requests";

type Filter = "all" | "active" | "suspended";

/** Team management and approvals (mobile admin_team.tsx). */
export function Team() {
  const members = useAdminStore((state) => state.members);
  const pending = useAdminStore((state) => state.pending);
  const status = useAdminStore((state) => state.teamStatus);
  const error = useAdminStore((state) => state.teamError);
  const tenant = useAdminStore((state) => state.tenant);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    void useAdminStore.getState().loadTeam();
    void useAdminStore.getState().loadTenant();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (member) =>
        (filter === "all" || member.status === filter) &&
        (!q || `${member.firstName} ${member.lastName} ${member.email}`.toLowerCase().includes(q)),
    );
  }, [filter, members, query]);

  const counts = {
    active: members.filter((member) => member.status === "active").length,
    suspended: members.filter((member) => member.status === "suspended").length,
  };

  return (
    <>
      <PageHeader
        title="Team"
        description={
          tenant ? `${tenant.memberCount} of ${tenant.memberCountLimit} seats used · ${counts.active} active, ${counts.suspended} suspended` : undefined
        }
        actions={
          <ButtonLink href={routes.admin.organization} variant="secondary" icon={<UserPlus className="size-4" />}>
            Invite examiner
          </ButtonLink>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block flex-1 sm:max-w-xs">
              <span className="sr-only">Search examiners</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-4" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or email"
                className="h-10 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-4 focus:border-brand"
              />
            </label>
            <Segmented
              label="Member status"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `All ${members.length}` },
                { value: "active", label: "Active" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
            {status === "error" && members.length === 0 ? (
              <LoadError message={error ?? "Unable to load team members"} onRetry={() => void useAdminStore.getState().loadTeam()} />
            ) : status === "loading" && members.length === 0 ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3 px-5 py-4">
                    <Skeleton className="size-9 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              members.length === 0 ? (
                <EmptyState
                  illustration="/illustrations/no_analyst.png"
                  title="No examiners yet"
                  description="Share your organization invite code. Approved examiners appear here."
                />
              ) : (
                <EmptyState compact title="No examiners match" description="Try a different search or filter." />
              )
            ) : (
              <ul className="divide-y divide-line">
                {visible.map((member) => (
                  <li key={member.id}>
                    <Link href={routes.admin.member(member.id)} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-canvas">
                      <Avatar firstName={member.firstName} lastName={member.lastName} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-ink">
                          {member.firstName} {member.lastName}
                        </span>
                        <span className="block truncate text-[12.5px] text-ink-3">{member.email}</span>
                      </span>
                      <span className="hidden text-[12.5px] text-ink-3 tabular sm:block">
                        {member.casesHandled} case{member.casesHandled === 1 ? "" : "s"}
                      </span>
                      {member.status === "suspended" ? <Badge tone="suspect">Suspended</Badge> : <Badge tone="genuine">Active</Badge>}
                      <ChevronRight className="size-4 text-ink-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <Panel title="Member requests" description={pending.length ? `${pending.length} waiting for approval` : undefined} bodyClassName="p-0">
          <MemberRequests />
        </Panel>
      </div>
    </>
  );
}
