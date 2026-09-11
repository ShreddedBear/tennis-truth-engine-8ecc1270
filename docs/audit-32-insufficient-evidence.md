# Forensic audit — the 32 current INSUFFICIENT_EVIDENCE decisions

**Scope.** Every match on the current slate whose terminal deterministic outcome is
`INSUFFICIENT EVIDENCE`. Read-only: no production row was written, no metric, family,
threshold or winner-selection rule was changed.

**Slate identified from live data, not assumed.** `prediction_slates` holds exactly one
non-retired slate (`slate_number = 1`, 60 matches). Of its 60 `final_decisions` rows, 32
carry `final_selection = 'INSUFFICIENT EVIDENCE'`, `final_audit_color =
'INSUFFICIENT EVIDENCE'`, `action = 'INSUFFICIENT EVIDENCE'`, `audit_run.independent_winner
IS NULL`, `audit_complete = true` and `completion_percent = 100`. The remaining 28 carry a
winner. The 32 are enumerated in `docs/forensics/insufficient-evidence-refusals.md`.

---

## 1. How the audit was done

The audit does **not** take the stored verdict on trust. It exports the same evidence the
pipeline consumed (`metric_results` for the 25 active codes, plus match/run/decision
metadata) and re-runs the production engines over it:

| production module | what the audit reads from it |
| --- | --- |
| `truth-engine-metric-comparison.ts` | per-metric P1 vs P2 comparison, direction, noise floor |
| `truth-engine-decision.ts` | family consolidation, directional share, 60% threshold, leave-one-family-out |
| `truth-engine-audit.ts` | verification, disagreement, underdog, stress |

`src/lib/truth-engine-refusal-forensics.ts` is a pure diagnostic layer over those outputs.
It selects nobody and changes nothing; deleting it would change no decision the product
makes (pinned by a test). Its only additions are arithmetic the production engines do not
themselves report:

* **Both players' directional shares**, unrounded, off one family census.
* **A per-player stress profile.** Production's `runStressTest` can only ever stress the
  *selected* side, and returns `NOT_APPLICABLE` when there is no selection. The audit runs
  the identical adverse shift against **each** player in turn, so the two are comparable.
* **A stage-by-stage trace** — family vote → 60% threshold → leave-one-family-out →
  verification → disagreement → underdog → stress → stored verdict.

**Reconstruction fidelity.** The independent reconstruction reproduces the stored verdict in
**32/32** cases, and the P1/P2 mirror check (swap both players' values; every side-specific
output must swap with them) holds in **32/32**. The decision core itself is symmetric.

Machine-readable output, one object per refusal with the raw per-metric evidence preserved
underneath the summary: **`docs/forensics/insufficient-evidence-refusals.json`**.
Human-readable, with a P1-vs-P2 profile table and a full metric table per match:
**`docs/forensics/insufficient-evidence-refusals.md`**.

Regenerate with:

```
bun run scripts/audit-insufficient-evidence-refusals.ts <snapshot.json> docs/forensics
```

The snapshot is produced by SELECT-only queries; the exact shape, and the two queries that
build it, are documented at the top of the script. The report JSON also embeds the raw
`p1_value` / `p2_value` strings for all 25 active codes per match under `metric_evidence`, so
every figure in this document can be re-derived by hand without database access.

---

## 2. Answer to the question that was asked

> (A) the engine genuinely cannot distinguish P1 from P2, or (B) a downstream step is
> incorrectly vetoing a valid comparative winner?

**Both, in different matches — and (B) is the largest single group.**

| classification | n | where the refusal is decided |
| --- | --- | --- |
| TRUE_TIE | 3 | decision core, family vote |
| BELOW_THRESHOLD | 8 | decision core, 60% threshold |
| CONFLICTED_EVIDENCE | 0 | — |
| ROBUSTNESS_UNRESOLVED | 0 | — |
| **DOWNSTREAM_VETO_BUG** | **14** | **STRESS stage, after a winner already existed** |
| DATA_OR_PIPELINE_BUG | 7 | metric execution — evidence never arrived |
| OTHER | 0 | — |

**11 of the 32 (TRUE_TIE + BELOW_THRESHOLD) are legitimate refusals** under the existing
rules, decided before any downstream stage runs.

**14 of the 32 are refusals of a winner the decision core had already made** — cleared the
60% threshold *and* survived leave-one-family-out — which the STRESS stage then withdrew.

**7 of the 32 are not comparative findings at all**: the evidence for one player never
arrived, so there was nothing to compare.

---

## 3. The 14 stress vetoes — what actually happens

### The trace is identical in all 14

In every one of the 14, the comparison is the **same named player** from the family vote all
the way through underdog, and changes for the first time at STRESS. Taking the leader as `L`
and the opponent as `O`:

```
family vote L → threshold L → leave-one-family-out L → verification L
              → disagreement L → underdog L → STRESS ✗ → stored INSUFFICIENT
```

`STRESS ✗` takes one of two shapes, and production treats both identically as a refusal:

* **the selection is REMOVED** (adverse case yields no leader at all) — 9 of the 14;
* **the selection is REVERSED** (adverse case yields `O`) — 5 of the 14.

Verification, disagreement and underdog never move the comparison — structurally they
cannot; they are read-only diagnostics, and nothing reads their output back into the
selection. Verification's own family census independently names the same leader as the
decision core in 32/32. The single stage that converts a winner into a refusal is STRESS.

### Nothing downstream of the audit can produce this refusal

For completeness, the stages after the Truth Engine audit were checked too. The persisted
colour is computed in `src/lib/audit-engine.ts:368-377`:

```ts
if (!auditComplete)                 color = "INCOMPLETE";
else if (!run.independent_winner)   color = "INSUFFICIENT EVIDENCE";
else if (unresolvedCritical || ...) color = "RED / PASS";
else if (greenLockReasons.length)   color = "YELLOW";
```

All 32 have `audit_complete = true` and `completion_percent = 100`, so the only branch that
can yield `INSUFFICIENT EVIDENCE` is `!run.independent_winner`. Coverage, green-locks,
matrix WP and the underdog/stress *counts* can move a real winner from GREEN to YELLOW or
RED, but none of them can turn a winner into "no winner". `run.independent_winner` is written
in `commitConclusion` (`audit-pipeline.ts`) directly from `audit.audit_winner`. So the entire
question reduces to `runTruthEngineAudit`, and inside it to the two lines below.

### The responsible code path

`src/lib/truth-engine-audit.ts:458`

```ts
const stressRefuses = selected !== null && stress.changed;
const finalSide = stressRefuses ? null : selected;
```

`stress.changed` is `adverseOutcome !== baseOutcome`, computed at
`truth-engine-audit.ts:389-395`:

```ts
const selected: "P1" | "P2" = before;
const adverseComparisons = shiftComparisons(comparisons, selected, -1);
const adverse = decideTruthEngineSelection({ comparisons: adverseComparisons, ... });
const after = outcomeOf(adverse);
```

and the shift itself, `truth-engine-audit.ts:352`:

```ts
const delta = spec.materiality * steps * (side === "P1" ? 1 : -1);
const advantage = Number((c.advantage_p1 + delta).toFixed(6));
const favours = Math.abs(advantage) <= spec.materiality ? "NEUTRAL" : advantage > 0 ? "P1" : "P2";
```

### Two defects in that path

**(i) The shift manufactures new opposing evidence out of declared parity.**

The delta is applied to *every* comparison, not only to those favouring the selected side.
The algebra:

Write `a` for the metric's leader-facing advantage and `m` for its declared noise floor.
The adverse case replaces `a` with `a − m` and re-reads the direction.

* A metric that **favours the leader** has `a > m`. After the shift it either stays above
  the floor (still the leader's) or lands in `(0, m]` and reads `NEUTRAL`. It can never
  become the opponent's, because that needs `a − m < −m`, i.e. `a < 0` — which contradicts
  `a > m`.
* A metric the engine declared **`NEUTRAL`** has `|a| <= m`. After the shift `a − m` can
  fall below `−m` — whenever `a < 0`, i.e. whenever the sub-floor difference happened to
  lean the opponent's way — and it then reads as **a vote for the opponent**.

So the adverse case does not merely erode the leader's edge — it converts metrics the
engine explicitly measured as *"both players measured, no material difference"* into
directional evidence for the opponent. At family level this shows up two ways: a family that
voted for nobody starts voting for the opponent, and a family that voted for the leader can
be handed to the opponent outright once its leader-favouring members are neutralised and one
of its previously-NEUTRAL members becomes an opponent vote. Those manufactured families are
recorded per match in the JSON as `stress_p1.families_manufactured_for_opponent` /
`stress_p2.families_manufactured_for_opponent`. Both halves of the algebra are pinned by
tests in `src/lib/truth-engine-refusal-forensics.test.ts`.

**(ii) The test is applied only to the leader, and its result is used as a veto.**

`runStressTest` returns early with `NOT_APPLICABLE` whenever no selection exists, and
otherwise stresses `before` — the selected side — only. The opponent's profile is never
subjected to the same erosion before the leader's selection is withdrawn. The audit ran the
mirror case for all 14:

| symmetric verdict | n | meaning |
| --- | --- | --- |
| LEADER_MORE_ROBUST | 9 | stressing the leader removes the selection, but stressing the **opponent** leaves the leader still ahead |
| NON_DISCRIMINATING | 5 | stress *either* player and the *other* one wins — the shift exceeds the evidence separation in both directions, so it ranks nobody |
| CHALLENGER_MORE_ROBUST | **0** | the opponent survives scrutiny the leader does not |

**In none of the 14 does the opponent survive the same scrutiny.** The veto therefore never
expresses a comparative finding about the two players; it removes the leader on a test the
opponent was never made to take. This is the pattern the brief named as
*"applying stress as a global veto"*, *"only testing the initial leader"* and
*"treating 'fragile' as 'no winner'"*.

### Worked example — Martin Landaluce vs Jacob Fearnley

The decision core selected Landaluce on **5 supporting families, 0 contradicting, 0
conflicted = 100% of the directional evidence**, corroborated, no leave-one-family-out
reversal. The measured edges:

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | family |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1739.52 | 1510.52 | +229 | 10 | **22.9×** | P1 | SURFACE_STRENGTH |
| 005 | Last-10 win % | 70 | 40 | +30 | 5 | **6.0×** | P1 | RECENT_FORM |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.274 | −0.18 | +0.454 | 0.1 | **4.5×** | P1 | IMPROVEMENT_TREND |
| 016 | Break-point score-state win % | 77.78 | 30.77 | +47.01 | 24 | 2.0× | P1 | POINT_BY_POINT |
| 053 | Pressure index % | 64.29 | 31.91 | +32.37 | 18 | 1.8× | P1 | POINT_BY_POINT |
| 036 | Losses as favourite % | 20 | 40 | −20 | 15 | 1.3× | P1 | LOSS_PROFILE |
| 002 | Service point win % | 53.49 | 57.02 | −3.54 | 10 | 0.35× | NEUTRAL | POINT_BY_POINT |
| 003 | Return point win % | 46.00 | 39.39 | +6.61 | 10 | 0.66× | NEUTRAL | POINT_BY_POINT |
| 031 | Opponent-adjusted set differential | −0.40 | −0.31 | −0.09 | 0.15 | 0.60× | NEUTRAL | COMMON_OPPONENT |
| 034 | Dominance ratio | 0.989 | 0.917 | +0.072 | 0.15 | 0.48× | NEUTRAL | POINT_BY_POINT |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0× | NEUTRAL | H2H_PROBABILITY |
| 068 | Current win/loss streak | 1 | 2 | −1 | 5 | 0.20× | NEUTRAL | RECENT_FORM |

The adverse case subtracts one noise floor from *every* row. The three big P1 edges survive
(22.9×, 6.0×, 4.5× are far beyond one floor). What flips the result is the bottom half of
the table — the rows the engine had declared **NEUTRAL**:

* **002** (P2 by 0.35 floors) becomes a P2 vote at 1.35 floors → **POINT_BY_POINT flips to P2.**
* **031** (P2 by 0.60 floors) becomes a P2 vote at 1.60 floors → **COMMON_OPPONENT flips to P2.**
* **068** (P2 by 0.20 floors) becomes a P2 vote → **RECENT_FORM becomes INTERNALLY_CONFLICTED**, since 005 still votes P1.
* **036** (1.3 floors) and the two POINT_BY_POINT P1 rows drop to NEUTRAL.

Result: 2 families for P1, 2 for P2, 1 conflicted → tie → `INSUFFICIENT_EVIDENCE`, and the
selection is withdrawn. Not one of Landaluce's three material edges was overturned; the
refusal is carried entirely by sub-noise-floor differences that the engine had already ruled
were not evidence of anything. Running the mirror case — the same shift applied to Fearnley
instead — leaves Landaluce ahead.

### The 14, with the profile that was vetoed

| match | leader | leader share | opponent share | contradicting families | stress → | symmetric verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Alexander Bublik vs Jeffrey John Wolf | P1 Bublik | 100% | 0% | none | INSUFFICIENT | LEADER_MORE_ROBUST |
| Martin Landaluce vs Jacob Fearnley | P1 Landaluce | 100% | 0% | none | INSUFFICIENT | LEADER_MORE_ROBUST |
| Hugo Dellien vs Matej Dodig | P1 Dellien | 80% | 20% | LOSS_PROFILE | P2 | NON_DISCRIMINATING |
| Stefano Travaglia vs Enrico Dalla Valle | P2 Dalla Valle | 80% | 0% | none | INSUFFICIENT | LEADER_MORE_ROBUST |
| Giovanni Mpetshi Perricard vs Jurij Rodionov | P2 Rodionov | 75% | 0% | none | INSUFFICIENT | LEADER_MORE_ROBUST |
| Benjamin Hassan vs Francesco Forti | P1 Hassan | 71.43% | 28.57% | LOSS_PROFILE, RECENT_FORM | P2 | NON_DISCRIMINATING |
| Norbert Gombos vs Svyatoslav Gulin | P1 Gombos | 71.43% | 14.29% | LOSS_PROFILE | INSUFFICIENT | LEADER_MORE_ROBUST |
| Brandon Nakashima vs Sebastian Baez | P1 Nakashima | 66.67% | 33.33% | LOSS_PROFILE | P2 | NON_DISCRIMINATING |
| Valentin Royer vs Dalibor Svrcina | P2 Svrcina | 66.67% | 0% | none | INSUFFICIENT | LEADER_MORE_ROBUST |
| Matteo Arnaldi vs James Duckworth | P2 Duckworth | 66.67% | 0% | none | INSUFFICIENT | LEADER_MORE_ROBUST |
| Hubert Hurkacz vs Damir Dzumhur | P2 Dzumhur | 66.67% | 0% | none | INSUFFICIENT | LEADER_MORE_ROBUST |
| Federico Bondioli vs Federico Arnaboldi | P2 Arnaboldi | 60% | 40% | CLOSING_ABILITY, RECENT_FORM | P1 | NON_DISCRIMINATING |
| Max Schoenhaus vs Alvaro Guillen Meza | P1 Schoenhaus | 60% | 40% | IMPROVEMENT_TREND, RESULTS_HISTORY | P2 | NON_DISCRIMINATING |
| Valentin Vacherot vs Aleksandar Kovacevic | P1 Vacherot | 60% | 20% | H2H_PROBABILITY | INSUFFICIENT | LEADER_MORE_ROBUST |

Two of these — Bublik and Landaluce — held **100% of the directional evidence with zero
contradicting and zero conflicted families**, and were still refused.

One caveat, stated so the finding is not overclaimed: **Bublik vs Wolf rests on a single
family** (POINT_BY_POINT, from one metric — dominance ratio at 3.8× its floor), with only 3
of 25 metrics comparable. Its 100% is uncorroborated, and `MIN_INDEPENDENT_SUPPORT_FAMILIES`
records that (`corroborated = false`). Under the current rules corroboration is *reported,
not enforced*, so the decision core correctly selected — but of the 14 this is the one whose
refusal is closest to defensible on other grounds. **Vacherot vs Kovacevic** is the other
thin case (3 supporting families, 1 contradicting, 1 conflicted, exactly 60.0%). The
remaining 12 rest on 2–5 corroborating families.

Full P1-vs-P2 profiles, per-metric values, treatments, sources and noise floors for each of
the 14 are in `docs/forensics/insufficient-evidence-refusals.md`.

---

## 4. The 7 DATA_OR_PIPELINE_BUG refusals

These are not comparative ties. In each, **no evidence family expressed a direction at all**,
and the reason is that one side's values never arrived:

| match | comparable metrics (of 25) | metrics with no usable treatment | side that failed |
| --- | --- | --- | --- |
| Francesca Jones vs Rositsa Dencheva | 1 | 24 | P2 on all 24; P1 on 19 |
| Sascha Gueymard Wayenburg vs Izan Almazan | 1 | 24 | P2 on all 24; P1 on 16 |
| Alexander Blockx vs Marcelo Tomas Barrios | 1 | 24 | P2 on all 24; P1 on 16 |
| Qinwen Zheng vs Kristina Liutova | 1 | 24 | P2 on all 24; P1 on 20 |
| Mark Lajal vs Motoharu Abe | 1 | 24 | P2 on all 24; P1 on 16 |
| Raphael Collignon vs Sebastian Gorzny | 1 | 24 | P2 on all 24; P1 on 16 |
| Mananchaya Sawangkaew vs Panna Udvardy | 3 | 20 | both sides on all 20 |

Persisted reasons are `NO_SOURCE_FOUND`, `HISTORICAL_DATA_UNAVAILABLE` and
`MISSING_REQUIRED_INPUT` — the evidence was never produced, not produced-and-refused. The
same slate produced 18 comparable metrics for a Challenger qualifying match
(Hassan vs Forti), so this is a per-match supply failure rather than a ceiling on what the
sources can provide. Slate mean: 9.41 comparable of 25, 10.81 with no usable treatment.

Classifying these as `TRUE_TIE` would be wrong: the engine did not measure both players and
find them level, it never measured one of them.

---

## 5. The 11 legitimate refusals

### BELOW_THRESHOLD (8)

A leader exists on family votes but holds under 60% of the directional evidence. All eight
carry at least one internally-conflicted family in the denominator — a family whose own
member metrics point opposite ways, which by design credits neither player while still
counting against the leader's share. That is the intended anti-double-counting behaviour,
not a defect.

| match | leader | leader share | supporting / directional | conflicted families |
| --- | --- | --- | --- | --- |
| Matej Dodig vs Mili Poljicak | P1 | 50% | 3 / 6 | COMMON_OPPONENT |
| Andrey Chepelev vs Fausto Tabacco | P1 | 50% | 3 / 6 | COMMON_OPPONENT, SET_PROFILE |
| Marek Gengel vs Alex Hernandez | P2 | 50% | 3 / 6 | RECENT_FORM |
| Matteo Berrettini vs Stan Wawrinka | P1 | 50% | 2 / 4 | COMMON_OPPONENT |
| Novak Djokovic vs Mariano Navone | P2 | 50% | 3 / 6 | COMMON_OPPONENT, POINT_BY_POINT |
| Alejandro Tabilo vs Yannick Hanfmann | P1 | 50% | 2 / 4 | COMMON_OPPONENT |
| Carlos Alcaraz vs Roman Safiullin | P2 | 50% | 3 / 6 | COMMON_OPPONENT, RECENT_FORM |
| Andrey Rublev vs Otto Virtanen | P2 | 40% | 2 / 5 | COMMON_OPPONENT, RECENT_FORM |

Neither player can be selected because neither reaches the product's stated bar. In seven of
the eight the leader holds exactly half the directional evidence; in the eighth (Rublev vs
Virtanen) it holds 40%. The shortfall is real in every case: it survives if you recompute it
by hand from the family census in `docs/forensics/insufficient-evidence-refusals.md`, and no
downstream stage is involved — the refusal is issued at
`truth-engine-decision.ts:255` before verification, disagreement, underdog or stress run.

### TRUE_TIE (3)

| match | P1 families | P2 families | conflicted | shares |
| --- | --- | --- | --- | --- |
| Tomas Martin Etcheverry vs Vit Kopriva | H2H_PROBABILITY, SURFACE_STRENGTH | IMPROVEMENT_TREND, POINT_BY_POINT | COMMON_OPPONENT | 40% / 40% |
| Genaro Alberto Olivieri vs Tiago Pereira | CLOSING_ABILITY, RESULTS_HISTORY | IMPROVEMENT_TREND, LOSS_PROFILE | COMMON_OPPONENT | 40% / 40% |
| Juncheng Shang vs Marco Trungelliti | IMPROVEMENT_TREND | POINT_BY_POINT | COMMON_OPPONENT, RECENT_FORM | 25% / 25% |

Both players were measured across 10–14 comparable metrics and the independent families
came out exactly level. Neither has a directional advantage, so neither can reach 60%.
These are refusals the design intends.

---

## 6. Are both players actually being audited? (STEP 7)

| check | result |
| --- | --- |
| P1/P2 identity lost in array transformations | **No.** Each comparison is built from one `metric_results` row carrying both sides; position is never used as identity. |
| Comparing sorted rows instead of players | **No.** Rows are keyed by `metric_code`; both values come from the same row. |
| Symmetry (swap P1/P2 → every output swaps) | **Holds, 32/32.** |
| Verification computed per player | **Yes.** `runVerificationAudit` derives each side's finding from that side's own values, and its own family census names the same leader the decision core did in **32/32**. |
| Disagreement computed per player | **Structurally one-sided but harmless.** `runDisagreementAudit` takes the selected side and reports only what argues against it; with no selection it reports nothing for anyone. It never changes the comparison. |
| Underdog computed per player | **No, never for both.** `runUnderdogAnalysis` (`truth-engine-audit.ts:277-279`) analyses only the *non-selected* side, and returns `NO_VIABLE_PATHWAY` immediately when there is no selection. Across the 32: **18 matches where it analysed neither player** (the decision core had already refused) and **14 where it analysed exactly one** (the non-selected side). The audit's own two-sided re-run finds evidence-backed pathways for a player in 25 of the 32, so the missing side is not empty — it is simply never asked. In the database, **0 of 960 `underdog_results` rows across these 32 runs reached `COMPLETE`** for either side. The stage contributed nothing to any of these refusals. |
| Stress computed per player | **No.** Only the selected side is ever stressed (§3). |
| Same stress result used for both players | **Effectively yes.** `stress_results` has no player dimension at all — 10 test rows per run, no `player_side` column — so a per-player stress result cannot be persisted even if one were computed. |
| Stress applied as a global veto | **Yes** — `truth-engine-audit.ts:458`. This is the defect in §3. |
| "Fragile" treated as "no winner" | **Yes.** `stress.changed` is true both when the adverse case *reverses* the winner and when it merely *removes* it; both produce `INSUFFICIENT_EVIDENCE`. 9 of the 14 are the "removed" case, where the mirror test shows the leader is the more robust of the two. |
| "Underdog detected" treated as a refusal | **No.** Underdog viability never feeds the winner. |
| A diagnostic stage acting as a second prediction engine | **Yes, one:** STRESS. It re-derives a full selection from shifted numbers and that re-derivation overrides the decision core. |
| Canonical player IDs | **Absent.** `matches.player1_id` / `player2_id`, `audit_runs.independent_winner_id` and `final_decisions.selected_player_id` are NULL on all 32 (and the `players` table holds 0 rows). Side identity rests on name and column position. This did not cause any of the 32 refusals, but it removes the check that would catch a future identity inversion. |

---

## 7. What was deliberately NOT done

No change to the 25 active metrics, their definitions, the 60% threshold, family
consolidation, the evidence threshold, or any winner-selection behaviour. No second
prediction engine. No winner inferred from colour, `final_selection`, or raw evidence
count. No production data written. The stress veto is documented above, not removed.

`git status` on this change shows **additions only** — three new files plus this document
and the generated report. Not one existing file was modified:

```
docs/audit-32-insufficient-evidence.md              (this document)
docs/forensics/insufficient-evidence-refusals.json  (machine-readable diagnostic)
docs/forensics/insufficient-evidence-refusals.md    (per-match P1 vs P2 profiles)
scripts/audit-insufficient-evidence-refusals.ts     (read-only runner)
src/lib/truth-engine-refusal-forensics.ts           (pure diagnostic layer)
src/lib/truth-engine-refusal-forensics.test.ts      (regression tests pinning the findings)
```

Note on evidence counts: none of the classifications above uses raw evidence count as a
criterion. Refusals here span 1 to 18 comparable metrics, and the 14 vetoed selections
include both a 3-metric case (Bublik) and an 18-metric case (Hassan). What separates the
groups is the comparative directional result, not how much evidence there was.

## 8. Recommended next step (for decision, not yet implemented)

The one change the evidence supports is making the stress stage **comparative** rather than
a one-sided veto: run the adverse case against *both* players and let it withdraw a
selection only when the opponent demonstrably survives scrutiny the leader does not
(`CHALLENGER_MORE_ROBUST`). On this slate that is 0 of 14, so 14 refusals would become
selections carrying their existing stability labels. Separately, the shift should erode
only edges that favour the side being stressed, so that families the engine measured as
NEUTRAL cannot be converted into votes.

Both are winner-affecting changes and are **not** part of this diagnostic task.
