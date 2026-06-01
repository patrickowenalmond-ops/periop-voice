---
name: Clerk Express v2 auth access
description: How to read the authenticated user on the backend with @clerk/express v2, and why req.auth.userId silently fails.
---

# Reading auth with @clerk/express v2

In `@clerk/express` v2, `req.auth` is a **function**, not an object. Accessing
`(req as any).auth?.userId` returns `undefined` for every request, so a
cookie-authenticated web user gets 401 on every API call (and JIT user-provision
inserts run with `clerk_user_id = default` / `undefined@unknown.com`, causing 500s).

**Always read identity via `getAuth(req)` from `@clerk/express`:**

```ts
import { getAuth } from "@clerk/express";
const auth = getAuth(req);
const userId = auth?.sessionClaims?.userId || auth?.userId;
```

This matches the canonical snippet in the clerk-auth skill
(`references/setup-and-customization.md`).

**Why:** Replit-managed Clerk web apps authenticate via session **cookies**, not
Bearer tokens. The 401 was never a frontend transport problem — do NOT add
`setAuthTokenGetter` / `Authorization: Bearer` to web clients (the skill forbids
it). The bug is always in backend middleware/`requireAuth` reading `req.auth`
wrong. Cookies are sent automatically same-origin and forwarded through the Vite
dev proxy.

**How to apply:** When debugging Clerk 401/500s on a web app, grep the backend
for `req.auth` / `(req as any).auth` and replace every usage with `getAuth(req)`.
Have `requireAuth` stash `req.userId` so downstream routes don't repeat the call.
