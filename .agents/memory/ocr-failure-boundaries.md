---
name: OCR failure boundaries
description: Reliability rules for screenshot imports when vision or tennis-data providers stall or fail.
---

Screenshot import must have separate bounded failure boundaries for vision recognition and downstream player resolution. If recognition succeeds but resolution fails or times out, preserve every recognized name and event field for manual verification instead of hanging or returning blank names. Resolve exact OCR names against historical identities as one batch before attempting live-provider validation; never run one broad historical-table scan per player. Plain-text fallback must reject app navigation, diagnostics, URLs, and timestamps before pairing lines as players.

**Why:** A tennis-provider outage allowed player resolution to hold an otherwise successful OCR request for more than two minutes. Even after bypassing provider validation, per-player fuzzy historical scans took about 44 seconds for 13 matchups and tripped the 15-second boundary; one exact-name batch lookup reduced the same real import to about 4 seconds. The plain-text fallback also interpreted an empty-fixtures app screen and its Replit hostname as nine fake matchups.

**How to apply:** Any OCR provider, resolver, cache, or parser change must keep both deadlines, preserve the batch historical fast path, skip fixture context when every recognized name has one exact local identity, bound optional context otherwise, avoid caching transient degraded resolution, and test both a valid matchup image/text path and a non-matchup UI screen.