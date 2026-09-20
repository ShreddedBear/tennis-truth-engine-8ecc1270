---
name: Truth data cutover
description: Evidence and safety rule for retiring the legacy Supabase Truth Engine runtime in favor of heliumdb.
---

Do not migrate the legacy Supabase Truth Engine match/audit population into heliumdb. Heliumdb is the authoritative dataset for the consolidated application; the Supabase history is intentionally excluded.

**Why:** The owner explicitly decided that the independent Supabase matches, audits, stages, decisions, grades, snapshots, and dependent evidence/results are legacy and are not required in the consolidated application.

**How to apply:** Remove active Truth Engine Supabase runtime calls by replacing their table and RPC behavior with PostgreSQL/Drizzle over existing heliumdb rows. Do not create UUID mapping, semantic matching, or history-import work unless a specific application dependency is discovered.