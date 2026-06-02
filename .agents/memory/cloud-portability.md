---
name: cloud-portability
description: How this app stays deployable to AWS/Azure and how Clerk custom JWT claims are typed.
---

# Cloud portability (AWS/Azure)

**Rule:** Keep every external dependency (DB, auth, AI, telephony) configured via env vars so moving clouds is a credential/config swap, not a code change. Avoid Replit-only features in runtime code paths.

**Why:** User directive — the app must be deployable to AWS or Azure later. The stack is already portable (pg/Drizzle on `DATABASE_URL`, standard `openai` SDK via `AI_INTEGRATIONS_OPENAI_BASE_URL`/`_API_KEY`, Vapi/EHR via plain env keys).

**Public base URL:** Never hardcode `REPLIT_DEV_DOMAIN`. Resolve the app's public origin via `getPublicBaseUrl()` / `publicUrlFor()` in `api-server/src/lib/publicUrl.ts`, which prefers `PUBLIC_BASE_URL` (set this in production) and falls back to `REPLIT_DEV_DOMAIN` for dev only. Used for the Vapi webhook callback in `routes/vapi.ts` and `lib/registerVapiWebhook.ts`.

**Vite dev plugins:** All Replit-only vite plugins (runtime-error-modal, cartographer, dev-banner) live inside the `NODE_ENV !== "production" && REPL_ID !== undefined` dynamic-import branch so prod builds exclude them.

# Clerk custom JWT claims typing

This app's Clerk JWT template exposes **custom** claims (`userId`, `email`, `given_name`, `family_name`, `firstName`, `lastName`) — not Clerk defaults. `auth.sessionClaims` is otherwise typed as an empty `CustomJwtSessionClaims`, so reading these fails typecheck.

**How to apply:** Custom claims must be declared in `api-server/src/types/clerk.d.ts` (global `CustomJwtSessionClaims` augmentation). If the JWT template adds/removes a claim, update that file in lockstep. `clerkUserId` from `sessionClaims?.userId || auth?.userId` is `string | null` — guard with `if (!clerkUserId) return 401` before DB use.
