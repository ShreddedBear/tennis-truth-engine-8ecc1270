# Metrics #027 & #029 — Opponent Finishing Ability + Psychological Response Proxy

Status: **DONE**, tour-scoped GO per `docs/audit-task-new-batch1-step0.md`'s
resolution. 16 new unit tests, all passing.

**Wiring update (later pass, code 027 only — 029 is out of that task's
scope):** this module was built and tested but never actually called from
the live pipeline (`warehouse-first-researcher.server.ts`'s
`Researcher.metrics()`) — see
`docs/ARCHITECTURE-FINDING-disconnected-hybrid-researcher.md` for the prior
precedent this exact situation follows. Code 027 is now wired in via
`src/lib/deterministic-batch1-standalone-metrics.server.ts`, a new tier
tried after the existing deterministic engines and before the PBP-packet/
CSV-warehouse/live-AI tiers. See
`src/lib/deterministic-batch1-standalone-metrics.test.ts` for an
integration-style test proving the wired path produces a real finding
against the real generated index. No changes to this module's own math.
029 remains unwired (not part of that task's assigned code list).

Files: `src/lib/audit-metric-027-opponent-finishing-ability.ts` (+
`.test.ts`), `src/lib/audit-metric-029-psychological-response-proxy.ts` (+
`.test.ts`).

## Tour scoping

Both metrics need the per-set score sequence (`set_scores`), which only
exists for **WTA_MAIN** and **ATP_CHALLENGER** in the static history index
(`docs/audit-task-new-batch1-step0.md` Step 0 table: 0.0% set-score
coverage for ATP_MAIN and WTA_CHALLENGER — their source CSVs only ever
carry `sets_for`/`sets_against` totals, never the per-set sequence). This
is a **structural schema gap**, not sparse data, so `ATP_MAIN` and
`WTA_CHALLENGER` are rejected outright at the lane-eligibility check
(`FINISHING_ABILITY_ELIGIBLE_LANES`), before any row-fetch happens — never
reported as an ambiguous `NOT_ENOUGH_DATA` that reads as "might fill in
with more data."

Both metrics compute over a **trailing window** (default `N=20`, caller
configurable), leakage-safe via `repositoryResultsRows(...,
{strictBefore: true})`, and are computed for both the player and the
upcoming opponent by calling the same function twice with each name.

## #027 Opponent Finishing Ability

- **Lead-protection rate**: of trailing matches where the player won set
  1, the percentage they went on to win.
- **Closing rate as underdog**: of trailing matches where the player lost
  set 1, the percentage they still came back to win.

A match contributes to neither rate if its set-score detail is missing or
the first set was tied (never guessed).

## #029 Psychological Response Proxy

A **close-set loss** is score-margin-only: `7-6`, `7-5`, or `6-4` from the
losing side — the same narrow-margin-at-6+-games shape #036/#037's
`isCloseMatch` uses per full match, applied here to a single set
(`isCloseSetLoss`). Only the *first* close-set loss in a match triggers
the "after a close-set loss" observation (a match with two close-set
losses in a row is not double-counted).

Reports:
- **Baseline match win rate** over the whole trailing window (unconditioned).
- **After a close-set loss**: win rate in the immediately-following set,
  and win rate in the match overall — a **same-player** comparison against
  that player's own baseline, not a cross-player scale.

**Dropped refinement**: a break-point-advantage-relative definition of
"close" (e.g. "lost a set despite holding break points") was considered
and explicitly **not implemented** — the static history index stores only
final set scores, no game/point-level data to compute it from.
Score-margin-only is what ships. Documented here per
`docs/audit-task-new-batch1-step0.md`'s resolution so it is not
re-attempted without new data.
