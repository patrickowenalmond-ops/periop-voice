---
name: Week calendar timezone bucketing
description: Pattern for day/week bucketing when server (UTC) and browser timezones can differ.
---

# Server-vs-client timezone bucketing for date-range views

When a view selects rows for a week/day window on the server but renders them into day columns on the client, server-local (usually UTC in the Replit container) and browser-local timezones can disagree on which calendar day a near-midnight timestamp belongs to. This causes boundary rows to be mis-selected or placed in the wrong column.

**Pattern used:** the **client is the authority** on day placement (it buckets each row by its own local calendar day and drops anything outside the visible window). The **server widens its query window by a ±1 day buffer** around the requested week so no boundary-time row is ever missed before the client can place it.

**Why:** decouples the two timezones — the server never needs to know the client's offset, and the client never misses a row. A max tz offset is well under one day, so a one-day buffer is always sufficient.

**How to apply:** any new calendar/agenda/day-grouped endpoint should over-fetch by a day on each side and let the client bucket by local day with an in-range bounds check. Do not assume server and browser share a timezone.
