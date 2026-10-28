import { NextResponse, type NextRequest } from "next/server";

import {
  buildBackendUrl,
  getBackendConfig,
  MissingConfigError,
} from "@/lib/server/config";
import {
  clearSessionCookie,
  isSameOriginRequest,
  readSessionToken,
  writeSessionCookie,
} from "@/lib/server/session";

// Same-origin proxy to the Avera API. It adds the server-only X-Api-Key and the
// bearer token from the httpOnly session cookie, so neither reaches the browser.
// Paths, methods, query strings and bodies are forwarded unchanged.


// Endpoints that answer with a fresh access token. The token is moved into the
// session cookie and stripped from the body the browser receives.
const TOKEN_ISSUING = new Set(["POST auth/login", "POST auth/join-invite-code", "POST tenants"]);

const FORWARDED_REQUEST_HEADERS = ["content-type", "accept", "cache-control"];
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "content-length",
  "location",
  "retry-after",
  "x-code-expires-at",
];

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, { params }: Context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ title: "Forbidden", detail: "Cross-site request blocked." }, { status: 403 });
  }

  const { path } = await params;
  if (path.some((segment) => segment === ".." || segment === "." || segment.includes("://"))) {
    return NextResponse.json({ title: "Bad request" }, { status: 400 });
  }
  const joinedPath = path.map(encodeURIComponent).join("/");

  let config: ReturnType<typeof getBackendConfig>;
  try {
    config = getBackendConfig();
  } catch (error) {
    if (error instanceof MissingConfigError) {
      console.error(`[avera-web] ${error.message}`);
      return NextResponse.json(
        { title: "Server not configured", detail: "The Avera API connection is not configured." },
        { status: 503 },
      );
    }
    throw error;
  }

  const headers = new Headers({ "X-Api-Key": config.apiKey });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = await readSessionToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const target = buildBackendUrl(config.baseUrl, joinedPath, request.nextUrl.search);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      { title: "Network error", detail: "Unable to reach the Avera API." },
      { status: 502 },
    );
  }

  const routeKey = `${method} ${path.join("/").toLowerCase()}`;
  if (TOKEN_ISSUING.has(routeKey) && upstream.ok && upstream.status !== 204) {
    return issueSession(upstream);
  }

  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  // Logging out or deleting the account ends the session on the backend; drop the cookie too.
  if ((routeKey === "POST auth/logout" || routeKey === "DELETE auth/delete") && (upstream.ok || upstream.status === 401)) {
    clearSessionCookie(response);
  }
  return response;
}

async function issueSession(upstream: Response) {
  let json: Record<string, unknown> | null = null;
  try {
    json = (await upstream.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }

  const accessToken = (json?.accessToken ?? json?.AccessToken) as string | undefined;
  if (!accessToken) {
    // Nothing to store (e.g. the invite request is pending); pass the body through.
    return NextResponse.json(json ?? {}, { status: upstream.status });
  }

  const expiresAt = (json?.expiresAt ?? json?.ExpiresAt ?? json?.expireAt ?? json?.ExpireAt) as
    | string
    | undefined;
  const response = NextResponse.json({}, { status: upstream.status });
  const session = writeSessionCookie(response, accessToken, expiresAt);
  return NextResponse.json(
    { session },
    { status: upstream.status, headers: response.headers },
  );
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
