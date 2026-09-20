---
name: Truth Engine preservation
description: Canonical boundary for restoration work that combines the Prediction product with the current Truth Engine.
---

Preserve the current repository's Truth Engine implementation during Prediction product recovery. Do not replace it with a Truth Engine from an older integrated commit, and do not use shell restoration as permission to migrate its database or authentication.

**Why:** The user confirmed that the current Truth Engine is canonical even when older task text or historical source describes a different persistence boundary.

**How to apply:** Recover Predictor, Parlay, API, and worker code around the current Truth Engine. Limit Truth Engine changes to the minimum product-shell route mounting needed to keep it accessible.

When the Truth Engine is mounted below a product path, Vite's asset base, TanStack Router's base path, and every static resource URL must derive from the same injected base. Verify the result in a browser by asserting visible route content and clean same-origin asset/runtime logs; redirects and HTTP 200 alone do not prove the client mounted.

**Why:** A multi-artifact restoration returned a valid HTML shell while the browser could not mount the routed application because generated asset and router URLs still assumed the domain root.

**How to apply:** Treat rendered-content coverage as part of any future product-shell or artifact-path change, including entry redirects and root-relative public assets.