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
Production builds have failed three separate ways while still exiting 0 and returning HTTP 200, all now caught by `artifacts/tennis-truth-engine/scripts/check-production-entry.mjs` (postbuild):
- A root `index.html` (legacy Vite SPA shell pointing at `/src/main.tsx`) is silently adopted by Nitro as the production renderer template, replacing TanStack Start SSR with a blank page. Never add an `index.html`; the document shell is `src/routes/__root.tsx`.
- Nitro's `baseURL` must equal `BASE_PATH` (`nitro.baseURL` in `vite.config.ts`). Otherwise the Worker's static assets sit at `/assets/*` while pages request `/truth-engine/assets/*`, every script/stylesheet 404s, and the client never mounts. Server-side ASSETS-binding fetches (the runtime tennis index) must include the same base.
- Nitro defaults the Cloudflare `compatibility_date` to today, which can exceed the installed workerd release and stop the Worker from starting. The build script pins `NITRO_COMPATIBILITY_DATE`.

**How to apply:** Verify the built Worker (`pnpm run preview`), not just `vite dev`: load `/truth-engine/app/upload` in a browser and assert visible content with zero same-origin 404s. Make sure no earlier preview process is still holding the port, or you will be testing a stale build.
