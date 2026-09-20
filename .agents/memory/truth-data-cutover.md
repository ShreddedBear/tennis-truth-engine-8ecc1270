---
name: Truth data cutover
description: Evidence and safety rule for retiring the legacy Supabase Truth Engine runtime in favor of heliumdb.
---

Treat a Truth Engine database cutover as a data migration, not a connection-string switch. Supabase and heliumdb have matching Truth table structures, primary-key coverage, and critical foreign-key chains, but their audit populations use different IDs. Shared ingestion reference data may already be identical while operational matches, audits, decisions, snapshots, and grades are not.

**Why:** Read-only reconciliation found active grading records in Supabase that were absent from heliumdb, while heliumdb contained a separate newer audit and upload population. A simple cutover would lose or orphan historical Truth records.

**How to apply:** Before retiring Supabase, export a relationship-preserving Supabase snapshot, classify exact duplicates versus Supabase-only rows, resolve any semantic duplicates without remapping UUIDs blindly, import parent tables before children, and verify row counts, keys, foreign keys, and per-table fingerprints.