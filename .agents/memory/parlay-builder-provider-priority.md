---
name: Parlay Builder provider priority
description: Required provider ordering and identity handling for Parlay Builder screenshot validation.
---

LiveTennisAPI is the Parlay Builder's primary provider for both OCR-resolved player identity and completed-match history. RapidAPI, API-Tennis, and Sofascore are fallbacks in that order.

**Why:** OCR already produces stable LiveTennis player IDs, while ranking-only providers can omit lower-ranked players or become unavailable. Re-searching elsewhere discarded source-backed identity and caused valid screenshot legs to report unavailable data.

**How to apply:** Pass the OCR-resolved LiveTennis ID into Builder validation and use it directly. If no source ID exists, try strict full-name resolution and then only an unambiguous surname match. Never fabricate IDs or relax ambiguity checks.