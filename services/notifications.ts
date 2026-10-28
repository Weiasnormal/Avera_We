import { apiJson, apiRequest } from "./api/client";
import { API_ENDPOINTS } from "./api/endpoints";

export interface BackendNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  resourceId: string | null;
  isRead: boolean;
  createdAt: string;
}

type Raw = Record<string, unknown>;

function normalize(raw: Raw): BackendNotification {
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    type: String(raw.type ?? raw.Type ?? ""),
    title: String(raw.title ?? raw.Title ?? ""),
    message: String(raw.message ?? raw.Message ?? ""),
    resourceId: (raw.resourceId ?? raw.ResourceId ?? null) as string | null,
    isRead: Boolean(raw.isRead ?? raw.IsRead),
    createdAt: String(raw.createdAt ?? raw.CreatedAt ?? ""),
  };
}

export async function fetchNotifications(): Promise<BackendNotification[]> {
  const payload = await apiJson<Raw[]>(API_ENDPOINTS.notifications.list);
  return (Array.isArray(payload) ? payload : []).map(normalize);
}

export async function markNotificationAsRead(id: string) {
  await apiRequest(API_ENDPOINTS.notifications.markAsRead(id), { method: "PATCH" });
}

export async function markAllNotificationsAsRead() {
  await apiRequest(API_ENDPOINTS.notifications.markAllAsRead, { method: "PATCH" });
}
