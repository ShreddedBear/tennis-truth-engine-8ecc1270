---
name: Audit source latency
description: Throughput rules for keeping resumable metric batches inside their invocation budget.
---

Synchronous local evidence builders must be selected by the requested metric families rather than running every analyzer for every batch. Async source packets and provider calls must have explicit outer deadlines, and exact-input result caches must be bounded, short-lived, and discard failures.

**Why:** A full local all-family scan blocked the event loop for minutes, so even correctly implemented timeout timers could not fire. Once local recovery became family-selective, live 15-metric batches completed in roughly 2–4 seconds.

**How to apply:** When adding an evidence source, declare which metric families can use it and skip it for all other batches. Keep exact player orientation and full context in cache keys; never cache failures or substitute timed-out evidence.