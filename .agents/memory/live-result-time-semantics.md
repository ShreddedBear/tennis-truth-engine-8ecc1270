---
name: Live-result time semantics
description: Why upcoming fixtures and completed-result records require separate timezone handling.
---

Completed-result provider adapters may normalize timestamps into UTC date and clock components, while upcoming-fixture adapters may expose tournament-local wall-clock time. Never assume these two representations need the same venue-timezone conversion when resolving a frozen fixture against a completed result.

**Why:** Reapplying the venue timezone to already-normalized UTC components shifted result times, which could make a terminal result appear to occur after a future scheduled start or prevent an otherwise defensible match join. The failure appeared only during live-data inspection, not type checking.

**How to apply:** Trace each provider field to its original timestamp before parsing or joining it. Require both frozen-fixture and result times to be past before grading, and fail closed when the source timezone is uncertain. Keep recent-result ingestion isolated from the historical research feature pipeline and its cutoff.