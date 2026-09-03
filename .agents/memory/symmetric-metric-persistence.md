---
name: Symmetric metric persistence
description: Why paired research writes and player-specific reconstruction must remain separate, with transactional evidence refreshes.
---

Persist both independently oriented sides returned by one metric research call together. Even when that settles both statuses, still run each player’s research/source-selection and reconstruction pass independently. Orient warehouse lookup by the active player, map every side-indexed field back before persistence, and resume in stable metric order. Refresh reusable evidence through one transactional conflict update and verify the returned row.

**Why:** Writing only the currently executing side caused a second research call to diverge. Conversely, marking both sides terminal accidentally skipped the second player’s independent research and reconstruction, reducing legitimate P2 coverage. Count-based resume over unordered rows can silently skip metrics. Delete/insert and application-level check/update patterns also created loss or race windows.

**How to apply:** Any metric execution or resumability change must preserve the paired snapshot, independent oriented P1/P2 attempts, stable identity-based resume order, settled-side recovery, side-specific diagnostics, and transactional evidence-store replacement.