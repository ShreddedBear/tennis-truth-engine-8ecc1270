---
name: Completed audit retention
description: Retention boundary between operational slate cleanup and immutable completed audit history.
---

Normal operational slate cleanup must not delete a match that has a completed audit run, its run-level metric/evidence snapshot, its summaries, or uploads still referenced by retained summary versions. Historical deletion requires a separate explicit retention policy.

**Why:** Treating completed audits as disposable slate state erased the snapshots needed for forensic comparisons and made coverage regressions impossible to reconstruct exactly.

**How to apply:** Any reset, cleanup, or retention change must identify completed-run matches before collecting deletion IDs and must delete only uploads that have no remaining summary-version reference.