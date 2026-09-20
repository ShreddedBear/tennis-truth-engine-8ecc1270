---
name: LiveTennisAPI history identity
description: Provider-specific identity and point-tape behavior that affects safe historical PBP retrieval.
---

LiveTennisAPI player search may return multiple exact-name singles IDs for one established player. Search history across all exact-name IDs, then rely on canonical match identity and duplicate-match guards rather than selecting one ID arbitrarily.

**Why:** Live diagnostics found legitimate duplicate exact-name IDs. Requiring exactly one ID prevented historical discovery entirely.

**How to apply:** Keep exact-name matching, reject doubles-team records, cap duplicate IDs, merge their histories, and deduplicate matches through the evidence firewall.

Some recent historical tapes contain score snapshots but omit `point_winner`; other tapes contain point winners with sequence gaps. Do not treat either shape as valid complete point-by-point evidence without a separately validated reconstruction method.

**Why:** Inferring winners from incomplete snapshots could manufacture metric inputs.

**How to apply:** Preserve explicit reconstruction-failure classification and require fixture-backed tests before adding any score-transition adapter.