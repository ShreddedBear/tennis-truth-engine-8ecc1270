# Truth Engine — live-data verification of the deterministic audit chain

Companion to `audit-truth-engine-decision-core.md`, which records *why* the decision core
was built (every decision stage delegated to the LLM researcher; 405 persisted runs with 0
verification findings, 0 disagreement risks, 0 underdog classifications and 0 independent
winners, while the stages themselves reported COMPLETE).

This document records the verification of that core **against real persisted data**, not
fixtures, and the two data-shape defects that verification exposed.

## What was verified

The deterministic chain was executed over real `metric_results` rows from two live audit
runs, and the exact row patches that reach the database were inspected.

### Run `c40f4025-fe6e-46f1-97ad-099baf3def4e` (Gonzalo Bueno vs Joao Lucas Reis Da Silva)

| Code | Family | P1 | P2 | Favours |
|---|---|---|---|---|
| 001 | SURFACE_STRENGTH | 1521.13 | 1465.29 | P1 |
| 005 | RECENT_FORM | 50 | 0 | P1 |
| 027 | CLOSING_ABILITY | 100 | 81.8 | P1 |
| 031 | COMMON_OPPONENT | -0.17 | -0.10 | NEUTRAL (within 0.15 noise floor) |
| 051 | H2H_PROBABILITY | 41.7 | 58.3 | P2 |
| 080 | COMMON_OPPONENT | 2 | -2 | P1 |

Derived outcome: **P1**, on 4 independent supporting families against 1 contradiction
family, stability STABLE. 031 and 080 share COMMON_OPPONENT and vote once.

Persisted rows actually populate:

- `verification_results` — distinct P1 and P2 findings per rule, e.g. rule 007
  `p1_finding="Gonzalo Bueno: Opponent-specific win probability %=41.7"`,
  `p2_finding="Joao Lucas Reis Da Silva: ...=58.3"`, outcome PASS; rule 019 outcome WARN.
- `disagreement_results` — `contradiction_severity=MAJOR` derived from magnitude against
  the metric's own noise floor (5.5x), with both `p1_risk` and `p2_risk` and the
  contradicting evidence quoted in `opposing_evidence`.
- `underdog_results` — `STYLE_MISMATCH` for the real underdog classified **STRONG** from
  the measured 051 edge; mapped-but-unsupported pathways classified WEAK with
  "evaluated and found not viable"; unmappable pathways UNAVAILABLE **with the reason**
  (e.g. SECOND_SERVE: "serve-number splits do not exist in the approved point-by-point
  payloads"). The previous hardcoded "no admissible evidence located" string is gone.
- `stress_results` — ST03 `winner_before=P1 → winner_after=P1` from an actual
  leave-one-family-out recomputation; ST05/06/07 from adverse recomputation
  ("support families 4 -> 3; winner P1 -> P1"). ST01/02/04/08/09/10 UNAVAILABLE with the
  specific missing evidence named.

### Run `01d106c2-13ba-494b-9c79-a2fc5f6c99bf`

Comparable set of 9; SET_PROFILE (008 P1 vs 010 P2) and COMMON_OPPONENT (031 P2 vs 080 P1)
are **internally conflicted** and therefore contribute nothing — the anti-double-counting
compression behaving correctly on real data rather than in a fixture.

## Defects the live data exposed, and the fixes

Both are registry-versus-producer **name** mismatches, proven against all 304 persisted
rows per code. Neither changes a metric definition, and neither guesses a direction.

1. **Metric 001 persists two shapes for one quantity.** 189/304 rows carry a bare scalar,
   102/304 carry `surface_elo=`. The registry only read the bare form, so keyed rows were
   silently `VALUE_NOT_PARSEABLE`. Fixed with `bareScalarFallback`, reading `surface_elo`
   and falling back to the bare scalar. `overall_elo` is a *different* quantity and is
   never substituted — pinned by test.

2. **Metrics 008/010 name field variants that essentially never appear.** The registry
   read `set3_deciding_set_win_pct` (1/304 rows) and `straight_set_match_win_pct` (1/304),
   while producers emit `deciding_set_win_pct` (87) and `straight_set_win_pct` (89) — the
   identical quantity, units and direction. Fixed with `fieldAliases`.

   `same_surface_straight_set_win_pct` is a **different population** and is deliberately
   *not* an alias; a row carrying only it stays `VALUE_NOT_PARSEABLE`. Likewise the bare
   counts 008/010 persist in 189 rows have no documented definition, so
   `bareScalarFallback` is deliberately **not** set for them.

An alias is only legitimate when it denotes the identical measurement. Both invariants are
enforced by tests, including a registry-wide check that no spec lists its own canonical
field as an alias and that `bareScalarFallback` is never set without a keyed field.

3. **Evidence-backed underdog pathways with no persisted row could vanish.** The persisted
   pathway vocabulary is tactical (serve/return/rally); several comparable evidence
   families are outcome-level and map to no pathway code. `unmappedUnderdogPathways()` now
   surfaces any such pathway in the underdog stage detail instead of dropping it silently.
   (Empty for both runs verified here.)

## Validation

975 tests across 135 files, clean `tsc --noEmit`, and a passing worker bundle build
(7.7MB / 25MB). One earlier run reported 3 failures that did not reproduce across seven
subsequent runs, including a cold-cache run with the touched modules invalidated; the
cause was not established and is recorded here rather than explained away.

## What this does NOT do

- It does not reactivate any of the 16 quarantined Matrix-Summary metrics, add Matrix
  Summary extraction, or depend on Matrix Summaries in any way.
- It does not rebuild Tennis Matrix AI or copy its prediction.
- It does not delete or rewrite any historical metric, evidence or audit record.
- It never converts UNAVAILABLE into zero, and never lets one-sided evidence become a lean.
