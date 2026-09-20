---
name: TanStack Start port boundary
description: Why the Tennis Truth Engine remains a full-stack TanStack Start web artifact in the multi-app workspace.
---

Keep the Tennis Truth Engine’s TanStack Start server functions and SSR runtime inside its web artifact instead of moving them into the shared Express API artifact.

**Why:** The product is built around many co-located `createServerFn` calls, server-only modules, and a generated runtime tennis index. Rewriting that boundary during a parity migration would create a high regression risk.

**How to apply:** Extend the existing TanStack Start runtime for Truth Engine behavior unless a separate, explicitly scoped task calls for extracting a stable API contract.