---
name: Truth Engine preservation
description: Canonical boundary for restoration work that combines the Prediction product with the current Truth Engine.
---

Preserve the current repository's Truth Engine implementation during Prediction product recovery. Do not replace it with a Truth Engine from an older integrated commit, and do not use shell restoration as permission to migrate its database or authentication.

**Why:** The user confirmed that the current Truth Engine is canonical even when older task text or historical source describes a different persistence boundary.

**How to apply:** Recover Predictor, Parlay, API, and worker code around the current Truth Engine. Limit Truth Engine changes to the minimum product-shell route mounting needed to keep it accessible.