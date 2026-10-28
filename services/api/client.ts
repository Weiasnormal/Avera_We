// Single entry point for backend calls from the browser. Every request goes to
// the same-origin proxy (/api/backend/...), which adds the API key and bearer
// token server-side.

export const NETWORK_ERROR_MESSAGE = "Network error. Please check your connection and try again.";
const REQUEST_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Same mapping as the mobile app's utils/networkError.getServerErrorMessage.
export function getServerErrorMessage(status: number, detail?: unknown): string {
  if (status >= 500) return NETWORK_ERROR_MESSAGE;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  return "Unable to complete the request. Please try again.";
}

export function backendUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/api/backend${normalized}`;
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

// The session store subscribes so a 401 anywhere signs the user out, as
// handleUnauthorizedResponse does in the mobile app.
export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export interface ApiRequestInit extends Omit<RequestInit, "body"> {
  body?: BodyInit | object | null;
  /** Treat 401/403 as an ordinary error instead of ending the session. */
  skipUnauthorizedHandling?: boolean;
  timeoutMs?: number;
}

async function readProblem(response: Response) {
  try {
    const json = await response.clone().json();
    return {
      code: typeof json?.title === "string" ? json.title : undefined,
      message: getServerErrorMessage(response.status, json?.detail ?? json?.message ?? json?.title),
    };
  } catch {
    return { code: undefined, message: getServerErrorMessage(response.status) };
  }
}

export async function apiRequest(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const { body, skipUnauthorizedHandling, timeoutMs = REQUEST_TIMEOUT_MS, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  if (!finalHeaders.has("Accept")) finalHeaders.set("Accept", "application/json");

  let finalBody: BodyInit | null | undefined;
  if (
    body === undefined ||
    body === null ||
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  ) {
    finalBody = body as BodyInit | null | undefined;
  } else {
    finalBody = JSON.stringify(body);
  }
  if (typeof finalBody === "string" && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  rest.signal?.addEventListener("abort", () => controller.abort());

  let response: Response;
  try {
    response = await fetch(backendUrl(path), {
      ...rest,
      headers: finalHeaders,
      body: finalBody,
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
  } catch (error) {
    if (rest.signal?.aborted) throw error;
    throw new ApiError(0, "Network", NETWORK_ERROR_MESSAGE);
  } finally {
    clearTimeout(timer);
  }

  // 401 ends the session. 403 stays an ordinary error (wrong role / other tenant),
  // so a forbidden action does not sign the user out.
  if (response.status === 401 && !skipUnauthorizedHandling) {
    unauthorizedListeners.forEach((listener) => listener());
    throw new ApiError(401, "Unauthorized", "Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const { code, message } = await readProblem(response);
    throw new ApiError(response.status, code, message);
  }
  return response;
}

/** Parses JSON, tolerating empty bodies (204, blank 200). */
export async function readJson<T = unknown>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function apiJson<T = unknown>(path: string, init?: ApiRequestInit): Promise<T | null> {
  return readJson<T>(await apiRequest(path, init));
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
