---
name: OCR matchup boundaries
description: Fail-closed pairing rules for multi-match tennis screenshot and document ingestion.
---

Treat each bordered card, blank-line-delimited record, explicit matchup heading, or inline `X vs Y` line as an independent OCR record. Never pair player names globally based only on proximity or sequence.

**Why:** Multi-card images and multi-record document pages place valid player names close together. Global consecutive-line pairing can silently combine players from adjacent matches, which is worse than rejecting an uncertain record.

**How to apply:** Preserve metadata only within the current explicit record. If a fallback cannot prove the two names share one record, omit that matchup and require manual correction rather than guessing.

Resolve recognized names only through provider-issued player IDs. A rankings feed returning no result is a coverage gap, not proof that the player does not exist; query a source-backed player-search endpoint before failing closed.

**Why:** Challenger and ITF players are often absent from ranking feeds even when the upstream provider has a stable singles identity. Fixture-only scans also miss legitimate players outside the current fixture window.

**How to apply:** Keep ranking sources and source-backed player search independent so one provider outage cannot prevent the others from running. Exclude doubles identities and preserve ambiguity unless the source marks one duplicate exact-name identity as currently ranked.