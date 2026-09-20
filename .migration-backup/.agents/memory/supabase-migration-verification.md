---
name: Supabase migration verification
description: External Supabase schema changes must be verified after merged code begins depending on them.
---

Do not assume a successful code merge or post-merge setup applied new migrations to the external Supabase project. Verify required columns and RPC functions before running audits that depend on them.

**Why:** Lease-aware audit code reached runtime while its lease migration was absent, causing every audit to fail before run creation with a schema-cache missing-column error.

**How to apply:** After merges containing Supabase migrations, compare runtime database capabilities with the merged code and apply the existing idempotent migration through the Supabase migration interface when needed.