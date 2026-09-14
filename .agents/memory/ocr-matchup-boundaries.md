---
name: OCR matchup boundaries
description: Fail-closed pairing rules for multi-match tennis screenshot and document ingestion.
---

Treat each bordered card, blank-line-delimited record, explicit matchup heading, or inline `X vs Y` line as an independent OCR record. Never pair player names globally based only on proximity or sequence.

**Why:** Multi-card images and multi-record document pages place valid player names close together. Global consecutive-line pairing can silently combine players from adjacent matches, which is worse than rejecting an uncertain record.

**How to apply:** Preserve metadata only within the current explicit record. If a fallback cannot prove the two names share one record, omit that matchup and require manual correction rather than guessing.