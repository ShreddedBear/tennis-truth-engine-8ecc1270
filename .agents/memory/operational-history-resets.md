---
name: Operational history resets
description: Safety rules for destructive replacement of Prediction, Parlay, evaluation, and Truth Engine operational histories.
---

Before clearing cross-system operational history, prove the replacement fixture source can return the full target date range and verify a restorable backup for every affected datastore.

**Why:** The bulk completed-match endpoint can reject a historical range even when its credential is configured. Supabase REST exports may also stop at the project row cap despite a large `Range` header, leaving large child tables only partially backed up.

**How to apply:** Run a small read-only fixture fetch first. For Supabase, paginate explicitly by response range until the returned page is short, reconcile exported counts against SQL counts, and only then invoke the transactional clear. Keep prediction/evaluation and Truth Engine recovery independently verifiable.