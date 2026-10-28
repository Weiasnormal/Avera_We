"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { routes } from "@/lib/routes";
import { logout } from "@/services/auth";
import { onHubEvent, payloadCaseId, payloadMessage, startRealtime } from "@/services/realtime";
import { useAdminStore } from "@/stores/admin";
import { useCasesStore } from "@/stores/cases";
import { useSessionStore } from "@/stores/session";
import { toast } from "@/stores/toast";

import { resetUserState } from "./session-provider";

/**
 * App-wide handling of NotificationHub events (mobile NotificationSignalRListener).
 * The hub requires the TenantId claim, so this only mounts inside the app shell.
 */
export function RealtimeListener({ role }: { role: "user" | "admin" }) {
  const router = useRouter();

  useEffect(() => {
    const stop = startRealtime();

    const endSession = (message: string) => {
      toast.error(message);
      void logout().finally(() => {
        resetUserState();
        router.replace(routes.signIn);
      });
    };

    const refreshCases = () => void useCasesStore.getState().load();

    const unsubscribers = [
      onHubEvent("UserSuspended", (payload) =>
        endSession(payloadMessage(payload, "You have been suspended by your organization administrator.")),
      ),
      onHubEvent("UserRemoved", (payload) =>
        endSession(payloadMessage(payload, "You have been removed from the organization.")),
      ),
      onHubEvent("UserDeleted", () => {
        if (role !== "admin") return;
        void useAdminStore.getState().loadTeam();
        void useAdminStore.getState().loadTenant();
        toast.info("A member deleted their account.");
      }),
      onHubEvent("TenantRenamed", (payload) => {
        const name = payload?.newName ?? payload?.NewName;
        if (typeof name === "string" && name.trim()) useSessionStore.getState().patchProfile({ organization: name.trim() });
        if (role === "admin") void useAdminStore.getState().loadTenant();
        toast.success("Organization updated");
      }),
      onHubEvent("CaseFlagged", (payload) => {
        if (payloadCaseId(payload)) refreshCases();
        toast.info("A case was flagged for internal review.");
      }),
      onHubEvent("NewCaseResult", (payload) => {
        const caseId = payloadCaseId(payload);
        refreshCases();
        if (role === "admin") {
          void useAdminStore.getState().loadTeam();
          toast.success(
            "A new case result is ready for review.",
            caseId ? { label: "Review", href: routes.admin.caseReview(caseId) } : undefined,
          );
        }
      }),
      onHubEvent("CaseReviewCompleted", (payload) => {
        const caseId = payloadCaseId(payload);
        refreshCases();
        if (role === "user") {
          toast.success(
            "Your case review is complete.",
            caseId ? { label: "View", href: routes.examiner.caseResult(caseId) } : undefined,
          );
        }
      }),
      onHubEvent("MemberRequestCreated", () => {
        if (role !== "admin") return;
        void useAdminStore.getState().loadTeam();
        toast.info("New member request", { label: "Review", href: routes.admin.team });
      }),
      onHubEvent("reconnected", () => {
        refreshCases();
        if (role === "admin") void useAdminStore.getState().loadTeam();
      }),
    ];

    // Hub delivery is best effort; refresh lists when the tab regains focus too.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refreshCases();
      if (role === "admin") void useAdminStore.getState().loadTeam();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      document.removeEventListener("visibilitychange", onVisible);
      stop();
    };
  }, [role, router]);

  return null;
}
