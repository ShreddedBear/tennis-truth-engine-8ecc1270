---
name: Symmetric metric persistence
description: Why paired research writes and player-specific reconstruction must remain separate, with transactional evidence refreshes.
---

Persist both independently oriented sides returned by one metric research call together. Even when that settles both statuses, still run each player’s reconstruction pass independently. Refresh reusable evidence through one transactional conflict update and verify the returned row.

**Why:** Writing only the currently executing side caused a second research call to diverge. Conversely, marking both sides terminal accidentally skipped the second player’s reconstruction. Delete/insert and application-level check/update patterns also created loss or race windows.

**How to apply:** Any metric execution or resumability change must preserve the paired research snapshot, settled-side recovery, both player reconstruction passes, side-specific unavailable diagnostics, and transactional evidence-store replacement.