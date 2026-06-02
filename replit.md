# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Vapi Webhook Setup (one-time)

The API server automatically registers the webhook URL with your Vapi assistant on startup via `registerVapiWebhook`. To complete the setup:

1. **Set Vapi credentials** in Replit Secrets:
   - `VAPI_API_KEY` — your Vapi API key
   - `VAPI_ASSISTANT_ID` — the assistant ID to register the webhook against
   - `VAPI_PHONE_NUMBER_ID` — the phone number ID used for outbound calls

2. **Set a webhook secret** (strongly recommended):
   - Generate any random string (e.g. `openssl rand -hex 32`)
   - Add it to Replit Secrets as `VAPI_WEBHOOK_SECRET`
   - Paste the **same value** into the Vapi dashboard: **Assistant → Server → Secret**
   - On startup, if `VAPI_WEBHOOK_SECRET` is absent the server emits a `WARN` and accepts all webhook requests without verification
   - The Settings page (admin view) shows a yellow warning when Vapi is live but the secret is missing

3. **Restart the server** after setting secrets — `registerVapiWebhook` runs at startup and will PATCH the Vapi assistant with the current webhook URL and secret automatically.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- **Cloud portability:** Build with industry-standard, deployment-agnostic technologies that can later run on AWS or Azure. Avoid proprietary Replit-only features wherever possible. Keep all external dependencies (DB, auth, AI, telephony) configured via environment variables so moving clouds is a credential/config swap, not a code rewrite. For the app's public origin (e.g. Vapi webhook callback), set `PUBLIC_BASE_URL` in production; `REPLIT_DEV_DOMAIN` is only a dev fallback.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
