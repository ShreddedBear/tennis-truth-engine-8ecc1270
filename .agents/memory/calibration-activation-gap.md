---
name: Calibration activation gap
description: Why Stats engine probabilities can cluster near 50 even when the evidence ensemble has meaningful separation.
---

A completed calibration refit can be stored as pending and leave no active calibration model. In that state, live predictions use the legacy Data Quality fallback, which can remove more than half of the raw ensemble's distance from 50 for high-DQ matches.

**Why:** A 30-day audit found 202 of 226 stored predictions between 45% and 55%. The raw evidence ensemble retained meaningful edges, but the fallback kept only about 43% of those edges. Activating the already quality-gated pending model restored statistically fitted probabilities.

**How to apply:** When predictions suddenly cluster around 50, check active and pending calibration state before changing feature weights or probability scales. Review and activate a pending model only through the guarded activation path and its quality gates; never bypass approval by editing flags directly.