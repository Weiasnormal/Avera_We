# Avera Web

Responsive web client for Avera, the forensic signature-verification platform. It is a migration of the
Android app ([Forensic_MobileApp](https://github.com/Weiasnormal/Forensic_MobileApp)) and talks to the same
.NET Minimal API and ML service — no backend changes are required for the core flows.

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Zustand.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

| Variable | Purpose |
| --- | --- |
| `AVERA_API_BASE_URL` | Base URL of the Avera API (mobile: `EXPO_PUBLIC_AVERA_API_BASE_URL`). |
| `AVERA_API_KEY` | Sent as `X-Api-Key` on every API call (mobile: `EXPO_PUBLIC_AVERA_API_KEY`). Server-only. |
| `AVERA_SESSION_COOKIE` | Optional name for the session cookie. Default `avera_session`. |

None of these are exposed to the browser. If either required value is missing, API calls answer
`503 Server not configured` and the server log names the missing variable.

Scripts: `npm run dev`, `npm run build`, `npm start`, `npm run lint`.

## How it talks to the API

```
browser ──/api/backend/<path>──▶ Next.js route handler ──<path>──▶ Avera API
           (session cookie)        adds X-Api-Key + Bearer token
```

- `app/api/backend/[...path]` forwards method, path, query and body unchanged. Endpoint paths, payloads and
  enum values are the mobile app's (`services/api/endpoints.ts`).
- The access token lives in an **httpOnly cookie**. Login (`POST /auth/login`), invite-code join and
  organization creation (`POST /tenants`) return new tokens; the proxy stores them and returns only the
  decoded claims. JavaScript never sees the token or the API key.
- Cross-site requests to the proxy are rejected (`Sec-Fetch-Site` / `Origin` check).
- A `401` from the API signs the user out everywhere; `403` is shown as an error without ending the session.
- `proxy.ts` gates pages by session, organization membership and role (`/admin/*` is Org Admin only). The API
  remains the authority for every request.
- Real-time events use the existing SignalR `NotificationHub` over HTTP long polling through the proxy, so
  the token stays in the cookie. If the hub is unreachable the app falls back to refreshing on focus and
  polling notifications.

## Feature map (mobile → web)

| Mobile | Web |
| --- | --- |
| Sign in, sign up (Examiner / Admin), verify email, resend | `/sign-in`, `/sign-up`, `/verify-email` |
| Forgot password → 6-digit code → reset | `/forgot-password` (one route; email and code stay in memory) |
| Join with invite code (QR or typed), pending approval | `/join`, `/pending` |
| Admin organization creation | `/organization/new` |
| Examiner dashboard, pending cards, daily limit | `/dashboard` |
| Case list, search, filters, sort | `/cases` |
| New analysis: details → 4 references + 1 suspect | `/analysis/new` |
| Processing, retry without re-upload | `/analysis/[caseId]/processing` |
| Results: verdict, review status, Grad-CAM views, PDF export | `/cases/[caseId]` |
| Statistics | `/stats`, `/admin/stats` |
| Profile, change name/photo/email/password, preferences, delete account | `/profile`, `/admin/profile` |
| Help & support | `/help`, `/admin/help` |
| Admin dashboard, member requests, team overview | `/admin` |
| Admin cases, supervisor review, PDF permission, internal-review flag | `/admin/cases`, `/admin/cases/[caseId]` |
| Team, member details, daily limit, suspend, remove | `/admin/team`, `/admin/team/[memberId]` |
| Organization, rename, member limit, invite code + QR | `/admin/organization` |

### Image acquisition (replaces Google ML Kit)

The mobile scanner was a native document scanner followed by `expo-image-manipulator` converting every image
to PNG. On the web the user picks or drops a PNG, JPEG or WebP file (up to 15 MB), draws an optional crop
around the signature, and the browser re-encodes it to PNG (`lib/image.ts`) before the same multipart upload
(`file` field, `reference-N.png` / `suspect.png`, `?index=`). Preprocessing and inference stay on the backend.

## Backend items to check

- **Verification email links.** The mobile app handles `avera://verify-email?userId&token…`. For the web,
  the backend's email links should point to `https://<web-host>/verify-email?userId=…&token=…` (same query
  parameters, including `type=change-email`, `email`, `newEmail`).
- **SignalR long polling** must be enabled on `/hubs/notification` (it is by default in ASP.NET Core).
- No CORS configuration is needed: the browser only calls the web app's own origin.

## Intentional differences from the mobile app

- Drafts and their images are kept in memory only (closing or reloading the tab discards them; the page warns
  before that happens). Nothing about a case is written to browser storage.
- Processing shows the real request stages (upload n of 4, analysis) instead of a simulated ML progress ring.
- The mobile "Key Findings" panel was disabled (`{false && …}`) and used placeholder metrics; it is not ported.
  Results show only values returned by the API: confidences, distance, threshold, verdicts and Grad-CAM images.
- After an admin overrides a verdict, lists no longer show the model confidence next to the overridden verdict.
- A `403` response no longer signs the user out (mobile did).
- The mobile reset-password screen treated an "invalid token" error as success. The web reports the error.
- After approval of a join request the user signs in again to get a token with the organization claim
  (mobile re-used the password it kept in memory; the web does not keep passwords).
- Push notifications become optional browser notifications for analyses that finish in a background tab.

## Project structure

```
app/            routes: (auth), (examiner), admin, api/backend proxy, api/session
components/     ui primitives, dialogs/modals, feedback, navigation, providers
features/       auth, analysis, results, cases, examiner, admin, profile, stats
services/       API client, endpoint map, auth / cases / admin / notifications / realtime
stores/         zustand: session, cases, analysis (drafts + jobs), admin, toast
lib/            formatting, validation (zod), image processing, JWT claims, server config
```
