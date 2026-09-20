---
name: Truth audit persistence contracts
description: Why Truth audit persistence mappings and retry identities must be validated against live heliumdb.
---

Truth audit persistence adapters must use live `heliumdb` columns, required fields, and business keys as their source of truth. Legacy Supabase-generated types can differ materially and must not define PostgreSQL insert shapes or retry predicates.

**Why:** During the cutover, legacy shapes appeared plausible but used nonexistent columns, omitted required fields, and produced over-broad retry deletes. Static typechecks did not catch those runtime SQL defects.

**How to apply:** Read-only introspect the relevant live tables and indexes before changing audit persistence. Keep explicit server-side mapping/allowlists, force workspace ownership, and test operation coverage, allowed output keys, retry identities, and preservation of unrelated stage rows.