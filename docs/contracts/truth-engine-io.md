# Truth Engine — Output Contract (Phase 0)

Scope: read-only documentation of what this engine already emits, traced to the actual
TypeScript interfaces in `src/lib/`. This is the contract Phase 1 (and any external consumer,
including the Prediction Engine or a comparison layer) should read against. No code was
changed to produce this document.

## 0. Independence verification (HARD INDEPENDENCE RULE)

Grep across `src/` for any reference to a Prediction Engine field (`prediction_engine`,
`predictionEngine`, `external_prediction`, `other_engine_probability`, `predixsport` used as a
probability input, etc.) inside the decision core turns up **nothing** in
`truth-engine-decision.ts`, `truth-engine-metric-comparison.ts`, or `truth-engine-audit.ts`.
The only place a name resembling an external prediction source appears in `src/lib/` is
`predixsport-public.ts` / `predixsport-recent.server.ts`, which are **evidence producers** for
specific metrics (006's `bad_loss_rate_pct`, some streak data) — i.e. raw historical-results
inputs, not a rival model's probability or selection. `decideTruthEngineSelection()`'s only
input type is `{ comparisons: MetricComparison[]; p1Name: string; p2Name: string }` — there is
no field anywhere in that shape, or in anything it calls, for an external probability.

**Verdict: the hard independence rule already holds, structurally, today** — not because a
filter strips out a prediction field, but because no such field exists anywhere in the
decision path to strip. The regression test the task mandates ("full verdict path with the
prediction field stripped and asserts an unchanged verdict") is currently **vacuously
satisfiable but not yet written** — recommend adding it explicitly in Phase 1 as a permanent
guard, even though nothing today would fail it, precisely so a future change that *does* wire
in a Prediction Engine field cannot accidentally make it load-bearing without the test
catching it.

**Corollary — the "compare against" side of the rule is not yet built.** The working agreement
allows accepting the Prediction Engine's probability as a payload to compare against and report
agreement/disagreement. No such payload is currently accepted, stored, or compared anywhere in
this repo. `docs/audit/baseline-gap.md` §4 covers the consequence (disagreement-rate cannot be
measured yet). This contract document is also the natural place to receive that payload's shape
once it exists — see §4.

## 1. The Prediction Engine's own contract — not found

The task instructs this document to "consume the prediction engine's contract at
`docs/contracts/engine-io.md`." That file does not exist in this repository, and no file
resembling it (`engine-io.md`, any `docs/contracts/` directory) exists in the sibling
`Tennis-Stats-Engine` repository either (confirmed by search — the closest artifact there is
`lib/api-spec/openapi.yaml`, an OpenAPI spec for its own API surface, generated Zod/TS types
under `lib/api-zod/`, and no dedicated io-contract markdown). **This is a real, named gap**:
this document cannot "consume" a contract that has not been written anywhere. Recommendation
for whoever owns the Prediction Engine repo: publish `docs/contracts/engine-io.md` there before
any cross-engine comparison work begins, so this engine has a real, versioned shape to read
rather than reverse-engineering one from generated API types.

## 2. What this engine actually emits today — traced to source

### 2a. The verdict (`TruthEngineDecision`, `truth-engine-decision.ts`)

| Field | Type | Meaning |
|---|---|---|
| `outcome` | `"P1" \| "P2" \| "INSUFFICIENT_EVIDENCE"` | The verdict. |
| `selected_player` | `string \| null` | Resolved player name, null iff refused. |
| `stability` | `"ROBUST" \| "STABLE" \| "FRAGILE" \| "NOT_APPLICABLE"` | Verdict strength, pre-stress-veto layer. |
| `evidence_percent` | `number` | Share of directional evidence held by the leader (rounded, display). |
| `directional_families` | `number` | Denominator of `evidence_percent` — supporting + contradicting + conflicted families. |
| `corroborated` | `boolean` | ≥2 independent supporting families. |
| `independent_support_families` / `independent_contradiction_families` | `string[]` | Named families, each counted once. |
| `neutral_families` / `conflicted_families` | `string[]` | Reported, excluded from (neutral) or counted against (conflicted) the directional share. |
| `flipping_families` / `tie_inducing_families` | `string[]` | Leave-one-family-out results. |
| `unavailable` | `Array<{metric_code, status, reason}>` | Every metric that produced no comparison, with its reason — never silently dropped. |
| `duplicated_support_metrics` / `duplicated_contradiction_metrics` | `string[]` | Same-family agreement explicitly not double-counted. |
| `families` | `FamilyEvidence[]` | Full per-family evidence chain. |
| `reason` | `string` | Human-readable justification, always present, always specific to the actual branch taken. |
| `evidence_chain` | `string[]` | One line per family, machine-generated audit trail. |

### 2b. Verdict strength / evidence quality, post-audit (`TruthEngineAuditResult`, `truth-engine-audit.ts`)

| Field | Type | Meaning |
|---|---|---|
| `audit_winner` / `audit_winner_side` | `string \| null` / `"P1"\|"P2"\|null` | Final winner after the stress veto — this, not `decision.selected_player`, is the authoritative post-audit value (see `can-it-say-no.md` §4 / G7). |
| `refused` | `boolean` | `true` iff `audit_winner_side === null`. |
| `evidence_strength` | `"HIGH" \| "MODERATE" \| "LOW" \| "NONE"` | Verdict strength, the single field closest to a "confidence" label, deliberately never a probability. |
| `decision` | `TruthEngineDecision` | The pre-audit decision core output (§2a), preserved for traceability. |
| `verification`, `disagreement`, `underdog`, `stress` | see below | Per-family votes and audit layers. |
| `independent_evidence_families` / `contradiction_families` | `number` | Support/contradiction family counts. |
| `leave_one_family_out_winner` | `string` | `"CHANGES"` or the outcome, diagnostic. |
| `final_reason` | `string` | The authoritative, human-readable explanation of the final state. |
| `evidence_chain` | `string[]` | Full audit trail across every layer. |

### 2c. Per-family votes (`FamilyEvidence`, embedded in `decision.families`)

`{ family: string; vote: "P1"|"P2"|"NEUTRAL"|"INTERNALLY_CONFLICTED"; supporting_metrics: string[]; opposing_metrics: string[]; neutral_metrics: string[]; comparisons: MetricComparison[] }`
— the full per-metric evidence for every family is always attached, never summarized away.

### 2d. Abstentions / evidence quality (`ActiveMetricReadiness`, `truth-engine-active-metrics.ts`)

`{ expected, usable, oneSided, unavailable, notExecuted, percent, eligible, eligiblePercent, byCode: [...] }`
— `byCode` carries, for every one of the 25 active metrics, its `outcome`
(`USABLE_TWO_SIDED | ONE_SIDED | UNAVAILABLE | NOT_EXECUTED`) and its `activation`
(`MetricActivationForMatch` — per-side `ActivationStatus`, whether it `countsTowardDenominator`).
This is the machine-readable abstention ledger: nothing here is ever silently missing, every
metric's fate is enumerated.

### 2e. Explicit rejection reasons (`RefusalForensics`, `truth-engine-refusal-forensics.ts`)

For any `INSUFFICIENT_EVIDENCE` outcome, `RefusalClassification` names exactly one of:
`TRUE_TIE | BELOW_THRESHOLD | CONFLICTED_EVIDENCE | ROBUSTNESS_UNRESOLVED |
DOWNSTREAM_VETO_BUG | DATA_OR_PIPELINE_BUG | OTHER`, plus a full `StageTrace` showing exactly
which stage (family vote → threshold → leave-one-family-out → verification → disagreement →
underdog → stress → persistence) removed the leader, if one ever existed. This is diagnostic
(read-only reconstruction over already-persisted evidence, never a second prediction engine)
but it is the most precise "explicit reasons for a rejection" surface in the codebase and
should be the primary source for any consumer-facing rejection-reason field.

### 2f. Persisted decision record (`TruthEngineDecisionRecord`, `truth-engine-decision-record.ts`)

The stable, versioned (`schema_version: 1`) shape actually written to storage — a flattened
combination of §2a/§2b/§2d plus `actual_winner` / `decision_correct` (null until resolved). This
is the closest thing to a public wire contract that exists today; any external consumer
(including a future Prediction Engine comparison) should read from this shape, not from the
internal `TruthEngineDecision`/`TruthEngineAuditResult` types directly, since this is the one
explicitly versioned for schema evolution.

## 3. Consumer-facing colour/action (`audit-engine.ts`)

Not itself part of the deterministic core's contract, but the final human-facing synthesis:
`color: "DOUBLE GREEN" | "GREEN" | "YELLOW" | "RED / PASS" | "INSUFFICIENT EVIDENCE" |
"INCOMPLETE"`, mapped to an `action` (`"PLAY"`-class / `"MONITOR / REDUCE"` /
`"INSUFFICIENT EVIDENCE"` / etc.). Listed here because it is the layer most likely to be read
by a non-engineering consumer, and because `docs/truth-engine-production-readiness-gap-audit.md`
already documents two defects in it (G6: DOUBLE GREEN structurally unreachable; G8: coverage
gate uses a static rather than dynamic denominator) that affect the colour but never the
underlying `outcome`/`selected_player` — a consumer reading colour alone could be misled about
confidence in a way a consumer reading the full decision record would not be.

## 4. What a future Prediction Engine payload should look like here (recommendation, not implemented)

Per the working agreement, this engine may accept the Prediction Engine's probability as a
payload to *compare against and report agreement/disagreement*, never as a decision input. If
implemented, it should be a field appended to the decision record (§2f) *after* the
deterministic verdict is computed — e.g. `external_prediction: { source: "prediction_engine";
probability: number; selected_player: string | null } | null`, populated post-hoc, read by
nothing in `truth-engine-decision.ts`/`truth-engine-audit.ts`, and covered by the
prediction-field-stripped regression test named in §0. This section is a recommendation for
Phase 2+; nothing here is implemented, and this document does not propose implementing it now.

## 5. Fields intentionally absent (by design, not omission)

- No probability of any kind anywhere in `TruthEngineDecision`/`TruthEngineAuditResult` —
  `evidence_support_percent`/`evidence_percent` are explicitly documented as "a selection
  feature, not a probability" and calibration (`truth-engine-calibration.ts`) is the only place
  a probability-like number (`calibratedProbability()`) is ever produced, and only downstream,
  read-only, post-hoc.
- No arbitrary metric/family weights anywhere — every consolidation is count-based (family
  votes, LOFO) or measured-sample-based (materiality/minSample), never a manually assigned
  weight.
