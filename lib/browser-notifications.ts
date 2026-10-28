"use client";

// Web counterpart of the mobile "Notifications" preference (expo-notifications):
// local alerts when a case finishes processing while the tab is in the background.

import { readPreference, writePreference } from "./preferences";

const KEY = "notificationsEnabled";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsEnabled(): boolean {
  return notificationsSupported() && readPreference(KEY, false) && Notification.permission === "granted";
}

/** Returns whether alerts are now active (permission may be denied by the browser). */
export async function setNotificationsEnabled(enabled: boolean): Promise<boolean> {
  writePreference(KEY, enabled);
  if (!enabled || !notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export function notifyProcessingResult(caseCode: string, outcome: "genuine" | "suspected" | "failed") {
  if (!notificationsEnabled() || document.visibilityState === "visible") return;
  const body =
    outcome === "failed"
      ? `Case ${caseCode} could not finish processing. Open Avera to retry.`
      : `Case ${caseCode} is ready. Result: ${outcome === "suspected" ? "Suspected" : "Genuine"}.`;
  try {
    new Notification(outcome === "failed" ? "Processing interrupted" : "Analysis complete", { body, tag: caseCode });
  } catch {
    // Some browsers only allow notifications from a service worker; ignore.
  }
}
