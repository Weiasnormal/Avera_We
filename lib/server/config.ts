import "server-only";

export const SESSION_COOKIE = process.env.AVERA_SESSION_COOKIE?.trim() || "avera_session";

export class MissingConfigError extends Error {}

export function getBackendConfig() {
  const baseUrl = process.env.AVERA_API_BASE_URL?.trim();
  const apiKey = process.env.AVERA_API_KEY?.trim();
  const missing = [
    !baseUrl && "AVERA_API_BASE_URL",
    !apiKey && "AVERA_API_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new MissingConfigError(
      `Missing environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local and set the backend values.",
    );
  }

  return { baseUrl: baseUrl!, apiKey: apiKey! };
}

// Same resolution as the mobile app's buildApiUrl: new URL("/path", base).
export function buildBackendUrl(baseUrl: string, path: string, search = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl);
  url.search = search;
  return url;
}
