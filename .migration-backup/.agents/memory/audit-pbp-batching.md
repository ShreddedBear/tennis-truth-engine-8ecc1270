---
name: Audit PBP batching
description: Reliability rule for provider-backed PBP retrieval inside resumable metric batches.
---

Approved PBP candidate retrieval must use bounded concurrency and must not run when the requested metric batch contains no PBP-eligible codes.

**Why:** Sequential per-match timeouts can multiply into several minutes before a metric batch persists, defeating the outer pipeline budget and causing repeated retries of the same checkpoint.

**How to apply:** Keep individual request timeouts, cap concurrency, gate provider work by the requested metric codes, and ensure the pipeline can persist progress between bounded batches.