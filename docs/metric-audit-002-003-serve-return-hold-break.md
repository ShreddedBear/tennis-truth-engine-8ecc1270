# Metrics 002/003 — Serve Profile / Return Profile — Hold % / Break % — Sequential Audit Record

Status: FIXED (partial) / PARTIAL / SOURCE REQUIRED

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, sections 2-3.

Metric 002 (Serve Profile), first named bullet: **Hold %** — the percentage of a player's own service games that they win. (Also: Service Points Won %, First-Serve-In %, First-Serve/Second-Serve Points Won %, Ace Rate, Double-Fault Rate, Break Points Saved %, Service Games Held, Serve-Out Reliability.)

Metric 003 (Return Profile), first named bullet: **Break %** — the percentage of opponent service games a player successfully breaks. (Also: Return Points Won %, First-Serve/Second-Serve Return Points Won, Break Points Created per Return Game.)

## 2. Permitted raw inputs
Chronological point-by-point data with server identity and game winner, from an approved BSD PBP adapter.

## 3. Sources inspected
- `src/lib/pbp-score-state-recovery.ts` (`reconstructPbpScoreState`) — the Task 18B live per-metric reconstruction engine, owned via `TASK18B_METRIC_CODES` (`deterministic-pbp-metrics.server.ts`'s `deterministicPbpMetricFromPacket`, wired into `warehouse-first-researcher.server.ts`).
- `src/lib/pbp-score-state-recovery.test.ts` — existing coverage.

## 4. Defect found and fixed
This engine's per-game replay loop already tallies `serviceGames`/`serviceGamesWon` and `returnGames`/`returnGamesWon` for every side on every game (used elsewhere in the same file for breakback/closeout metric 018) — but neither figure was ever included in the `add("002", ...)` or `add("003", ...)` output objects. Metric 002's own first named bullet (Hold %) and metric 003's own first named bullet (Break %) were therefore never reported at all, despite the exact data needed already being computed in the same function.

The file's own header comment explains that a *plain aggregate* hold%/break% was deliberately kept off codes 026/027 during a Task 20 reconciliation, because those two real codes turned out to be a different, more specific concept ("Early-Warning/Slow-Start Metrics": first-service-game hold rate and closing performance, not a whole-match aggregate). That reasoning is correct for 026/027 — but 026/027 are not 002/003. The removal appears to have discarded the aggregate hold%/break% figures entirely rather than routing them to the two codes that actually define them as their own first-named bullet.

**Fix:** `service_games`/`service_games_won`/`hold_pct` added to code 002's value object; `return_games`/`return_games_won`/`break_pct` added to code 003's value object, both computed from the same `totals[side]` tallies the replay already produces. Purely additive — no existing field removed or renamed.

## 5. Treatment classification
Unchanged (`PARTIAL`) for both codes — correctly so. Neither metric's full bullet set is satisfied even after this fix: 002 still lacks first/second-serve splits (First-Serve-In %, First-Serve/Second-Serve Points Won %) because the approved PBP schema does not carry a serve-number indicator (`serve_number_available:false`, unchanged), and 003 has the same gap for its own serve-number-dependent bullets. Service Games Held and Serve-Out Reliability (002) and Break Points Created per Return Game (003) also remain unaddressed.

## 6. Reconstruction/formula verification
- `hold_pct` = `serviceGamesWon / serviceGames` for the serving side, over every game in the replay where that side served — the exact definition ("the percentage of a player's own service games that they win").
- `break_pct` = `returnGamesWon / returnGames` for the returning side — the exact definition ("the percentage of opponent service games a player successfully breaks").
- Both reuse `gameWinner()`'s existing majority-of-points-with-margin game-outcome logic (or an explicit `winner`/`postGames` field when present), not a new or separate calculation.

## 7. Provenance/sample/persistence
No change to `raw_fields`/`transformation` semantics beyond adding `"game_winner"` to the listed raw fields for both codes (accurately reflecting that game-level, not just point-level, data is now used).

## 8. Cross-wiring audit
Confirmed `add("002", ...)` and `add("003", ...)` remain the only two call sites for these codes in this file; `026`/`027` are not touched by this change and still correctly have no hold%/break% content, consistent with their real, different definitions.

## 9. Legitimate unavailable-data recovery
Recovered/fixed:
- Hold % (metric 002) and Break % (metric 003) — each metric's own first named bullet — are no longer silently omitted.

Still SOURCE REQUIRED (unchanged by this pass):
- First-Serve-In %, First-Serve/Second-Serve Points Won % (002); First-Serve/Second-Serve Return Points Won (003) — all need a serve-number indicator the approved PBP schema does not carry.
- Service Games Held, Serve-Out Reliability (002); Break Points Created per Return Game (003).

## 10. Regression protection
Added `src/lib/pbp-hold-break-percentage.test.ts` proving, with a small hand-computed fixture (Player1 serves and holds 2/2 games, is broken 0 times; Player2 serves once and is broken, returns twice and breaks 0):
- `service_games`/`service_games_won`/`hold_pct` are correct for both sides on code 002.
- `return_games`/`return_games_won`/`break_pct` are correct for both sides on code 003.
- Treatment stays `PARTIAL` for both codes (no over-claiming).

Certification: FIXED (partial) / PARTIAL / SOURCE REQUIRED. No evidence inflation.
