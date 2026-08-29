# Metric 009 — Comeback/Pressure Behavior — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

**Supersedes prior audit dated 2026-08 (pre-BSD-PBP pass), reason: PBP data
now confirmed ingested.** Section 3 below originally stated "Repository
search found no imported chronological break/serve-out/point-state feed
that can legitimately reconstruct the missing submetrics." That is now
stale: `data/audit/bsd-{atp,wta}-{main,challenger}-pbp-history/` (BSD/Bzzoiro
approved point-by-point adapters) and their live wiring in
`src/lib/pbp-score-state-recovery.ts` (`TASK18B_METRIC_CODES`, which
includes `"009"`) and `src/lib/bsd-atp-main-pbp.server.ts` (and its
WTA/Challenger siblings) do exist and are already live-wired into
`deterministic-pbp-metrics.server.ts`'s `SUPPORTED` set. See §11 below for
what this changes and, importantly, what it does not.

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 9.

Required submetrics:
- Wins From Behind
- Break-Consolidation Rate
- Serving-for-Set Conversion
- Serving-for-Match Conversion
- Pressure-Point Performance
- Clutch Hold/Break Performance
- Tiebreak Record

## 2. Permitted raw inputs
Permitted inputs are pre-match historical score/state observations that directly identify trailing state, break chronology, serving-for-set/match opportunities, break/set/match points, high-leverage hold/break situations, and tiebreak outcomes. Generic match-level break-point %, close-match win %, deciding-set %, Elo, market data, Matrix outputs, or unrelated set-front-runner statistics are not valid substitutes.

## 3. Sources inspected
- DataHub ATP ordered set scores support the subset “won match after losing Set 1” and tiebreak wins/losses.
- DataHub ATP match stats contain aggregate break-point totals but no chronology identifying break consolidation, serving-for-set/match, set points, match points, or high-leverage game states.
- PredixSport ATP match history contains results/set totals but no point/game sequence for the missing pressure states.
- PredixSport WTA ratings do not provide the required event-state observations.
- Repository search found no imported chronological break/serve-out/point-state feed that can legitimately reconstruct the missing submetrics.

## 4. P1/P2 orientation
The DataHub score parser reverses winner-perspective set scores for a requested loser. Comeback and tiebreak calculations therefore remain player-oriented. Regression tests explicitly verify the requested player's comeback and tiebreak results.

## 5. Treatment classification
The broad family is PARTIAL when the supported set-behind/tiebreak subset exists. Atomic outputs are RECONSTRUCTED from explicit historical scores. Unsupported pressure-state components remain SOURCE REQUIRED.

## 6. Reconstruction/formula verification
- Set-1-behind comeback subset = match wins / matches where the player lost Set 1. This legitimately supports part of “Wins From Behind” but not every possible in-set/in-match trailing state, so the family remains PARTIAL.
- Tiebreak Record = tiebreak sets won / tiebreak sets played, based on explicit ordered set scores.
- No formula substitutes generic break-point conversion/saved rates for pressure-point performance.
- No deciding-set or generic close-match statistic is used as a proxy for clutch high-leverage hold/break performance.

## 7. Provenance/sample/persistence
Supported reconstructed values preserve player identity, DataHub source URL, retrieval timestamp, denominator sample and RECONSTRUCTED origin. The metric row preserves the PARTIAL treatment and explicit missing-state explanation rather than erasing it when a subset value exists.

## 8. Cross-wiring audit
Removed from metric 009 wiring because they do not satisfy the exact definition:
- `break_points_saved_pct`
- `break_point_conversion_pct`
- `close_match_win_pct`
- `historical_deciding_set_win_pct`
- `deciding_matches_played`
- `win_after_winning_set1_pct`

Allowed local keys are now limited to `win_after_losing_set1_pct`, `tiebreak_win_pct`, and `tiebreaks_played`.

## 9. Legitimate unavailable-data recovery
Recovered from existing score history:
- partial Wins From Behind evidence via Set-1-deficit comeback rate
- Tiebreak Record

Still SOURCE REQUIRED:
- Break-Consolidation Rate
- Serving-for-Set Conversion
- Serving-for-Match Conversion
- combined Break/Set/Match Pressure-Point Performance
- high-leverage Clutch Hold/Break Performance

## 10. Regression protection
Added `src/lib/metric-009-pressure-contract.test.ts` proving:
- prohibited generic BP/close-match/deciding-set/set-front-runner fields cannot be wired into 009
- comeback and tiebreak evidence stay oriented to the requested player

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence inflation.

## 11. Re-audit against BSD approved PBP (this pass)

**New evidence found.** `reconstructPbpScoreState` in
`src/lib/pbp-score-state-recovery.ts` replays each approved BSD PBP match's
chronological server/point-winner sequence and, for code `"009"`, tallies
`pressure_points` / `pressure_points_won` / `pressure_win_pct` — points
played at break point, deuce, or in a tiebreak, oriented to the requested
player, via `add("009","PARTIAL",{pressure_points,...},...)`
(`pbp-score-state-recovery.ts:106`). This is genuinely additional,
qualifying evidence for the metric's **Pressure-Point Performance**
submetric, which §9 above previously listed as fully SOURCE REQUIRED with
no partial coverage at all. It is delivered as a `POINT_BY_POINT`
observation (`family:"POINT_BY_POINT"`, `key:"task18b_approved_pbp_score_state"`)
carrying source URL, match ID, retrieval date, and point/game sample size —
consistent with this project's provenance rule.

**What this does not change:**
- The family classification stays **PARTIAL** — it already was.
- **Break-Consolidation Rate** and **Serving-for-Set/Match Conversion**
  remain SOURCE REQUIRED for code 009 specifically. The PBP replay does
  compute breakback and closeout data, but per `pbp-score-state-recovery.ts`'s
  own header comment it is deliberately assigned to code **018** ("Momentum
  & Closing Metrics" — a different metric family with its own definition),
  not to 009, because 018's named bullets ("Performance Following Momentum
  Events", "Closing Ability... serving-for-match position") are the exact
  match, not 009's. Crediting the same breakback/closeout values to 009
  would be the cross-code mismatch this project's own reconciliation passes
  (Task 19/20) already exist to prevent — not applied here.
- **Clutch Hold/Break Performance** gets only the coarse break-point/deuce
  subset (`pressure_win_pct`) via this path, not a dedicated hold-vs-break
  split under high leverage — still PARTIAL, not upgraded to RECONSTRUCTED.
- The set-1-deficit comeback and tiebreak-record evidence from DataHub
  (§§3-10 above) is unaffected and unchanged; PBP is a second, independent
  evidence source for a different submetric of the same PARTIAL family.

**Test-gate gap found and closed.** `metric-009-pressure-contract.test.ts`
(the file this doc's §10 already points to) only locks the DataHub
`hybrid-audit-research.server.ts` wiring path. It said nothing about the
PBP `pressure_points` path, so nothing was guarding it against a future
accidental merge of 018's breakback/closeout fields into 009's PBP output.
Added a cross-wiring regression test asserting exactly that boundary (see
`src/lib/pbp-score-state-recovery.test.ts`, existing coverage, plus the new
case in `metric-009-pressure-contract.test.ts`).

**Classification:** unchanged (PARTIAL). **Evidence basis:** expanded —
Pressure-Point Performance now has a real, tested, tour-guarded partial
source where previously it had none. **324-cell coverage count:** no change
— code 009 was already counted as RECONSTRUCTABLE-potential/PARTIAL in
`docs/evidence-coverage/81-metric-recoverability-audit.md` row 009; this
pass adds evidence depth, not a treatment upgrade, so it does not move the
cell count.
