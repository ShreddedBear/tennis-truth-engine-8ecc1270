# Phase 0 Audit — Can the Engine Actually Say No?

Scope: read-only. Traces whether the code is structurally capable of the three mandated
outputs, and if not, what blocks each. Traced through `truth-engine-decision.ts`,
`truth-engine-audit.ts`, `truth-engine-decision-record.ts`, `audit-engine.ts` (the
consumer-facing colour/action synthesis), and cross-checked against the 60-run production
snapshot recorded in `docs/truth-engine-production-readiness-gap-audit.md`.

**Headline finding: the deterministic core can already produce all three outputs, and
production data confirms all three are actually reached in practice — not merely
theoretically possible.** This is a materially different answer than the task's framing
assumed ("if the code cannot currently produce (a) or (c), that is a P0 finding") — it can,
and does. What this document adds beyond "yes" is exactly where each output is produced, how
it is distinguished from the others downstream, and the one place a P1-severity issue could
still convert a legitimate refusal into a false "no result" or vice versa (§4).

## (a) "The prediction is not supported by independent evidence"

**Can it say this? Yes — and it is the single most common outcome in production.**

Mechanism: `decideTruthEngineSelection()` returns `outcome: "INSUFFICIENT_EVIDENCE"` with an
explicit `reason` string in four distinct circumstances, each independently reachable:

1. No family produced a usable two-sided comparison at all (`!families.length`).
2. Independent families are tied (`base.leader === null`) — reported with the real evidence
   share (e.g. "2 for X vs 2 for Y"), not collapsed to a fake 0%.
3. A leader exists but holds `<60%` of the directional evidence (`rawPercent <
   EVIDENCE_SELECTION_THRESHOLD`) — the reason string names the exact percentage and which
   families support/oppose.
4. A leader clears 60% but leave-one-family-out reverses it (`flipping.length`) — refused as
   contradicted, not merely thin, with the reversing family named.

A fifth path exists one layer up, in `runTruthEngineAudit()`: even a selection that cleared
all four of the above can still be withdrawn post-hoc if the symmetric stress test produces a
genuinely comparative finding (`stressRefuses`, §(b) below) — `finalSide = null` in that case
too.

This is **not just about the Truth Engine independently** — critically, this refusal capacity
is explicitly independent of whatever the Prediction Engine said (see
`docs/contracts/truth-engine-io.md`: nothing in `truth-engine-decision.ts` reads a prediction
field at all). A refusal here is never "we disagree with the other model," it is "our own
25-metric evidence doesn't clear our own bar" — which is the correct reading of (a) for an
engine whose whole value is an independent route to an answer.

**Production evidence this is real, not theoretical:** 32 of 60 recorded decisions (53%) are
`INSUFFICIENT EVIDENCE` in the live colour distribution (`docs/truth-engine-production-readiness-gap-audit.md`
§E). This is the majority outcome on the current 60-match slate, not an edge case.

## (b) "We agree, but confidence must stay low"

**Can it say this? Yes**, via two independent, stacking signals, both surfaced in the
persisted decision record and both distinct from a bare P1/P2 outcome:

1. **`corroborated: boolean`** (`decision.corroborated`) — `false` whenever the selection
   rests on a single supporting family rather than ≥2 independent ones. The reason string for
   such a selection explicitly appends: *"this selection rests on a single evidence family, so
   it is uncorroborated by an independent second family."* This is reported even when the
   selection is otherwise accepted — it downgrades confidence without downgrading the outcome
   to a refusal.
2. **`stability: "ROBUST" | "STABLE" | "FRAGILE"`** and `evidence_strength: "HIGH" | "MODERATE"
   | "LOW" | "NONE"` (`runTruthEngineAudit()`) — `evidence_strength` is explicitly computed as
   `LOW` whenever support is thin even with an accepted outcome (`supportCount < 3` and not
   `contraCount === 0`), and `stability: "FRAGILE"` is exactly the state a leader gets when it
   fails its *own* adverse stress case but the challenger doesn't survive its own either — kept
   as a selection, labeled fragile, never silently promoted to full confidence.

Downstream, `audit-engine.ts`'s colour synthesis turns this into a genuinely distinct,
consumer-facing state: `YELLOW` → action `"MONITOR / REDUCE"`, as opposed to `GREEN`/`DOUBLE
GREEN` → `"PLAY"`-class actions. **Production evidence this is real:** 22 of 60 decisions are
`YELLOW` (vs. 2 `GREEN`, 0 `DOUBLE GREEN`, 4 `RED/PASS`) — again the second-most-common
outcome, not a theoretical state nobody reaches.

## (c) "Insufficient evidence to validate either way"

**Can it say this? Yes — this is outcome (a) under a different framing** (the task lists them
separately; in this codebase they are the same mechanism, `INSUFFICIENT_EVIDENCE`, and the
`reason` string is what distinguishes "genuinely contradicted" from "genuinely thin/absent"
for a human reader). The `DATA_OR_PIPELINE_BUG` vs. `TRUE_TIE` vs. `BELOW_THRESHOLD` vs.
`CONFLICTED_EVIDENCE` vs. `ROBUSTNESS_UNRESOLVED` classification in
`truth-engine-refusal-forensics.ts` exists specifically to answer, for any given refusal,
*which* flavour of "insufficient" occurred — including the specific case the task's phrasing
implies (near-total absence of usable evidence): `classify()`'s `DATA_OR_PIPELINE_BUG` branch
fires exactly when almost nothing was comparable at all (`comparedCount === 0` or
`supplyFailures >= comparedCount` with zero directional families), distinguishing "we have no
evidence" from "we have evidence and it's genuinely a tie."

## Where "guessing" is structurally prevented, not just discouraged

Every layer this audit read states, and the code enforces, "no side is credited" as the
default in the absence of proof:
- `compareMetricRow`: one-sided evidence → `UNAVAILABLE`, never a lean (§ neutral-votes.md §1).
- `voteFor`: a family with zero directional metrics → `NEUTRAL`, excluded from the
  denominator, never coerced into a side.
- `decideTruthEngineSelection`: `!families.length` → refusal, not a coin flip.
- `runStressTest`'s erosion: clamped at zero, so it can weaken a lead but can never manufacture
  a flip through zero into an opposing vote (verified in `neutral-votes.md` §4).

## 4. The one place a real gap exists — calibration-target ambiguity (G7)

This is not a gap in the *decision* core's ability to refuse — it is a gap in which refusal
gets *recorded as the calibratable prediction* downstream, and it is already flagged (as P1,
not yet fully closed as of the last forensic pass) in
`docs/truth-engine-production-readiness-gap-audit.md` §G7: the decision **record**'s
`selected_player`/`outcome` fields are populated from the **pre-audit** decision-core value
(`decideTruthEngineSelection`'s own output), while `audit_runs.independent_winner` is the
**post-audit** value (after the stress veto in §(b)/(a)#5 above may have already withdrawn it).
Production showed **14 of 32 refusals** carrying a non-null
`gate_report.deterministic_decision.selected_player` while `independent_winner` was null — i.e.
a run that *should* read as case (a)/(c) could, if graded from the wrong field, be recorded as
a confident prediction that never actually shipped. The gap audit calls this "workstream B" and
notes the stress-veto fix is the only mechanism that can create this specific divergence; it
should be re-verified once that workstream lands (recommended as the first check in Phase 1's
baseline harness, since it directly determines which field a calibration observation is built
from).

**This does not mean the engine "cannot currently produce (a) or (c)."** It means one specific
downstream consumer (calibration observation-building) must read `independent_winner`
(post-audit) rather than the pre-audit `selected_player`, or it will misgrade an engine refusal
as a confident, ungraded prediction. `truth-engine-decision-record.ts`'s own
`isResolvedObservation()` correctly requires a non-null `selected_player` *and* a non-null
`actual_winner`, so an unresolved/refused record is at least excluded from calibration as a
resolved observation either way — the risk is specifically about *which* selected_player value
a resolved-looking record carries, not about whether refusals leak into the calibration set at
all.

## 5. Conclusion

All three mandated outputs are structurally present in code, are distinguishable from each
other in the persisted output (`outcome`, `corroborated`, `stability`, `evidence_strength`,
colour/action), and are demonstrably reached in the current production slate at materially
high frequency (53% refusal, 37% low-confidence-accept, 3% high-confidence-accept, 7%
red/pass, 0% double-confirmed). The one open risk is not "can it say no" but "does the right
consumer read the right field when it does" — tracked as G7, not a P0 blocker on this Phase 0
audit's own terms.
