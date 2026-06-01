---
name: Reusable create/edit form dialogs
description: Conventions for the shared *-form-dialog.tsx components (patient/procedure) and a refetch-wipes-edits pitfall.
---

# Reusable form-dialog components

Create/edit forms in periop-voice are factored into shared dialog components
(e.g. `patient-form-dialog.tsx`, `procedure-form-dialog.tsx`) consumed by both
their list page and other surfaces (the dashboard calendar, inline-from-scheduling).
A single dialog handles both create and edit: pass an optional entity prop; when
present it prefills and uses the update mutation, otherwise it creates.

After a mutation succeeds, invalidate every query that renders the entity — the
list query AND the single-entity query (and the dashboard calendar query when the
entity appears there) — or some open view will show stale data.

## Pitfall — query refetch wiping in-progress edits
The prefill `useEffect` must NOT depend on the entity OBJECT when that object
comes from React Query. A background refetch (window focus, reconnect,
invalidation) changes the object identity and would silently `form.reset()` while
the user is typing, losing their input.

**Rule:** key the prefill effect on `open` and the entity's stable `id`
(`[open, entity?.id]`), not the object. Reset only on open transitions or when the
target id changes.

**Why:** React Query objects are unstable references; depending on them couples
form lifecycle to network timing.
