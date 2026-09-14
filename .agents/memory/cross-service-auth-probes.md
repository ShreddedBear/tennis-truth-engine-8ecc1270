---
name: Cross-service auth probes
description: Why service-boundary authorization must not depend on routing back through the shared preview origin.
---

For an independently routed artifact, enforce shared admin authorization locally at that service boundary instead of fetching another service's same-origin auth endpoint.

**Why:** Managed readiness probes can call the service directly on its local host and port. A middleware fetch to `/api/auth/status` then resolves back to the same service, recurses, and prevents the health probe from completing even though proxied browser traffic would route correctly.

**How to apply:** When services share an authentication credential, validate its signed cookie or trusted identity headers locally and fail closed. Keep readiness responses non-sensitive and avoid cross-service network dependencies in request middleware.