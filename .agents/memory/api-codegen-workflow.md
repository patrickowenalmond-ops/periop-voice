---
name: API OpenAPI codegen workflow
description: How to add an endpoint type-safely end to end, and a known pre-existing typecheck failure in the codegen step.
---

# Adding an API endpoint (type-safe, end to end)

The API contract is OpenAPI-first. To add an endpoint that the React app can call type-safely:

1. Implement the Express route under `artifacts/api-server/src/routes/`.
2. Add the path + any new schemas to `lib/api-spec/openapi.yaml`.
3. Run `pnpm --filter @workspace/api-spec run codegen`.
4. Restart the `artifacts/api-server: API Server` workflow so the new route is live.

Codegen produces the React Query hook (`use<OperationId>`) and the TS types (interfaces named after the schema) in `lib/api-client-react/src/generated/`, re-exported from `@workspace/api-client-react`. A query param object is passed as the first hook arg, e.g. `useGetDashboardCalendar({ weekStart })`.

**Why:** the frontend never hand-writes fetch calls or types — they all flow from the spec, so the spec is the single source of truth.

## Known gotcha — codegen "fails" but actually succeeded
The codegen script chains `orval ... && pnpm -w run typecheck:libs`. There is a **pre-existing, unrelated** type error in `lib/integrations-openai-ai-server/src/image/client.ts` (`response.data` possibly undefined) that makes the whole command exit non-zero. The orval generation itself completes first ("Your OpenAPI spec has been converted") — verify the generated hook/types exist rather than trusting the exit code.

**How to apply:** after running codegen, grep the generated `api.ts`/`api.schemas.ts` for your new operationId/schema to confirm success; ignore the `integrations-openai-ai-server` typecheck error unless you are specifically working on that package.
