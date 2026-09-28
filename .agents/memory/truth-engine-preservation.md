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

For TanStack Start production builds, do not keep an old Vite `index.html` beside the app. Nitro can silently bundle that file as its HTML renderer, so all routes return a successful response with a dead client entry even while development routes render correctly. Also pin Nitro's Cloudflare compatibility date to one supported by the installed Worker runtime rather than allowing the build day to become the compatibility date.

**Why:** A published Truth Engine returned blank pages with HTTP 200 from a stale HTML renderer, while a local production preview initially failed because its generated Worker date was newer than the local runtime supported. Development alone did not reveal either failure.

**How to apply:** Check the built Worker on a real nested route and confirm visible content and working assets; run the production-entry guard on every build. If runtime tooling changes, verify the pinned date against the actual Worker binary before adjusting it.

When building below `/truth-engine`, Nitro may emit public assets at the output root even though Vite emits client URLs under the path prefix. The build must place files at those prefixed URLs, and verification must load JavaScript and CSS in a browser rather than checking only the HTML response.

**Why:** An otherwise healthy local production Worker returned the correct route HTML but every `/truth-engine/assets/` request was 404; the page stayed blank until the asset layout was corrected.

**How to apply:** Include built asset requests and visible content in the production-preview check whenever changing Vite, Nitro, or artifact routing.