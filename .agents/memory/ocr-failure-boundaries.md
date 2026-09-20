---
name: OCR failure boundaries
description: Reliability rules for screenshot imports when vision or tennis-data providers stall or fail.
---

Screenshot import must have separate bounded failure boundaries for vision recognition and downstream player resolution. If recognition succeeds but resolution fails or times out, preserve every recognized name and event field for manual verification instead of hanging or returning blank names. Plain-text fallback must reject app navigation, diagnostics, URLs, and timestamps before pairing lines as players.

**Why:** A tennis-provider outage allowed player resolution to hold an otherwise successful OCR request for more than two minutes. The plain-text fallback then interpreted an empty-fixtures app screen and its Replit hostname as nine fake matchups.

**How to apply:** Any OCR provider, resolver, cache, or parser change must keep both deadlines, avoid caching transient degraded resolution, and test both a valid matchup image/text path and a non-matchup UI screen.