"use client";

import {
  HttpTransportType,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";

import { backendUrl } from "./api/client";
import { API_ENDPOINTS } from "./api/endpoints";

// One shared connection to the backend NotificationHub (/hubs/notification).
// It runs over HTTP long polling through the same-origin proxy, so the bearer
// token stays in the httpOnly cookie instead of being handed to JavaScript.

export type HubEvent =
  | "UserSuspended"
  | "UserRemoved"
  | "UserDeleted"
  | "TenantRenamed"
  | "CaseFlagged"
  | "NewCaseResult"
  | "CaseReviewCompleted"
  | "MemberRequestCreated"
  | "MemberRequestApproved"
  | "MemberRequestRejected"
  | "MemberRequestDeclined";

const ALL_EVENTS: HubEvent[] = [
  "UserSuspended",
  "UserRemoved",
  "UserDeleted",
  "TenantRenamed",
  "CaseFlagged",
  "NewCaseResult",
  "CaseReviewCompleted",
  "MemberRequestCreated",
  "MemberRequestApproved",
  "MemberRequestRejected",
  "MemberRequestDeclined",
];

export type HubPayload = Record<string, unknown> | undefined;
type Listener = (payload: HubPayload) => void;
type StatusListener = (connected: boolean) => void;

const listeners = new Map<HubEvent | "reconnected", Set<Listener>>();
const statusListeners = new Set<StatusListener>();
let connection: HubConnection | null = null;
let refCount = 0;

function emit(event: HubEvent | "reconnected", payload?: HubPayload) {
  listeners.get(event)?.forEach((listener) => listener(payload));
}

function setStatus(connected: boolean) {
  statusListeners.forEach((listener) => listener(connected));
}

export function onHubEvent(event: HubEvent | "reconnected", listener: Listener) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(listener);
  return () => {
    listeners.get(event)?.delete(listener);
  };
}

export function onHubStatus(listener: StatusListener) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function payloadCaseId(payload: HubPayload): string | null {
  const value = payload?.caseId ?? payload?.CaseId;
  return typeof value === "string" && value ? value : null;
}

export function payloadMessage(payload: HubPayload, fallback: string): string {
  const value = payload?.message ?? payload?.Message;
  return typeof value === "string" && value.trim() ? value : fallback;
}

/** Starts the shared connection (ref-counted). Returns a stop function. */
export function startRealtime(): () => void {
  refCount += 1;
  if (!connection) {
    const absoluteUrl = new URL(backendUrl(API_ENDPOINTS.hub), window.location.origin).toString();
    connection = new HubConnectionBuilder()
      .withUrl(absoluteUrl, { transport: HttpTransportType.LongPolling, withCredentials: true })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.None)
      .build();

    for (const event of ALL_EVENTS) {
      connection.on(event, (payload?: HubPayload) => emit(event, payload));
    }
    connection.onreconnected(() => {
      setStatus(true);
      emit("reconnected");
    });
    connection.onreconnecting(() => setStatus(false));
    connection.onclose(() => setStatus(false));

    const current = connection;
    current
      .start()
      .then(() => setStatus(true))
      .catch(() => setStatus(false));
  }

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    refCount -= 1;
    if (refCount <= 0 && connection) {
      const current = connection;
      connection = null;
      refCount = 0;
      if (current.state !== HubConnectionState.Disconnected) void current.stop().catch(() => undefined);
    }
  };
}
