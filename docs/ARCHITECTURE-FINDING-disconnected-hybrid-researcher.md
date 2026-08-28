# Major finding: an entire evidence-gathering layer is disconnected from production

Status: CONFIRMED, NOT ACTED ON — needs a human decision before any code changes.

## The finding

While auditing metric 004, I traced exactly which code produces evidence for
a live audit run and found that a large, clearly substantial subsystem is
never actually called by production audits. It is exercised only by its own
unit tests.

**The one and only place the real pipeline gets its researcher:**
`src/lib/audit-repo.server.ts` line 13:
```
now: () => new Date(), research: warehouseFirstResearcher,
```
This is unconditional — no environment variable, feature flag, or fallback
switches it. Verified this is the *only* commit this file has ever had
(`19e9459`), so there was never an earlier version wired to anything else.

**What `warehouseFirstResearcher` actually calls** (traced from its own
import list in `warehouse-first-researcher.server.ts`): the
`deterministic-*-metrics.server.ts` engines (ranking, market, environment,
results-schedule, rules-context, PBP-from-packet), the four BSD PBP
adapters, `source-observation-metric-bridge.server.ts`, and
`metric-wiring-078-081.server.ts`'s `finalMetricWiringResearcher` chain
(→ `metric-wiring-072-076.server.ts` → `protected-metric-wiring.server.ts`
→ `validated-completion-research.server.ts` / `completion-sweep-research.server.ts`).
All of these read from Supabase (`source_observations`, `matches`, the
repository-results tables) or the four approved BSD PBP JSONL files.

**What is never called from any of that:** `hybrid-audit-research.server.ts`
(`hybridResearcher`) and everything that exists only to feed it --
confirmed by grepping every one of these for importers outside their own
file, their own tests, and each other:
- `predixsport-recent.server.ts`, `predixsport-derived.server.ts`,
  `predixsport-strength.server.ts`, `predixsport-h2h.server.ts`,
  `predixsport-common.server.ts`, `predixsport-dataset.server.ts` (the whole
  Kaggle PredixSport CSV warehouse)
- `datahub-atp-serve-return.server.ts`, `datahub-atp-score-profile.server.ts`
  (the DataHub ATP CSV files, including the metric-011 audit from earlier
  this pass)
- `availability-layoff.server.ts` (the metric-013 fix from earlier this pass)
- `travel-burden.server.ts`, `court-context.server.ts`,
  `weather-context.server.ts`, `tournament-context.server.ts`
- `wta-official-match-evidence.server.ts` (a live api.wtatennis.com
  integration -- the other half of the metric-013 fix)
- `matchup-efficiency.server.ts`, `common-opponent-enhanced.server.ts`,
  `ranking-performance.server.ts`, `style-matchup.server.ts`
- `resilient-audit-research.server.ts` (`resilientResearcher`, a wrapper
  around `hybridResearcher`) and `hybrid-research.server.ts`

`completionSweepResearcher` (used by `protected-metric-wiring.server.ts`,
which *is* live) does import `hybridResearcher` — but only reachable for
codes in `POST_FIX_CODES = ["060","062","063","064","065","066","067","069","070","071"]`.
012 and 013 are not in that set, so even that narrow doorway doesn't reach
the two metrics this pass already touched in the static layer.

## Why this matters

Two of this session's earlier fixes (before this one) patched real bugs in
code that is not on the path a live audit run actually executes:
- `docs/metric-audit-011-volatility-floor.md`'s subject file
  (`datahub-atp-score-profile.server.ts`)
- `docs/metric-audit-012-fatigue-workload.md`'s subject files
  (`predixsport-recent.server.ts`, `wta-official-match-evidence.server.ts`,
  `travel-burden.server.ts`)
- `docs/metric-audit-013-availability.md`'s fix
  (`availability-layoff.server.ts`, `wta-official-match-evidence.server.ts`)

Those fixes are still correct and still worth having (dead code that's
wrong is worse than dead code that's right, and this may get reconnected),
but they do not currently change what a live audit reports. This pass's
other fixes (metric 001, 002/003, 012's second wiring path, 019) *are* on
the live path and do currently change live behavior.

This also means the project's actual live evidence coverage is narrower
than the sheer volume of code suggests: metrics that only have a static-CSV
engine and no `deterministic-*-metrics.server.ts`/PBP-packet/live-AI
counterpart get **zero** evidence from any of that static work today, no
matter how well it's built.

## What this is NOT (checked, ruled out)

- Not a feature flag or env-var switch — grepped for both, found none.
- Not reachable via a fallback-on-error path in the pipeline itself —
  `audit-pipeline.ts`'s `executeStage`/`executeMetrics` call `deps.research`
  directly, and `deps` is only ever constructed once, in `audit-repo.server.ts`.
- Not used by a different route that also drives real audits — the only
  other reference to this cluster anywhere in `src/` is
  `evidence-coverage-runtime-diagnostic.server.ts`, wired to
  `src/routes/api/evidence-coverage-diagnostic.ts` — a diagnostic/reporting
  endpoint, not the audit-scoring path.

## Not acted on, and why

Reconnecting this layer (routing `warehouseFirstResearcher` — or
`deterministic-*-metrics.server.ts`'s deterministic fallthrough — through
`hybridResearcher` as an additional source) or deliberately deleting it are
both real, consequential architectural decisions:
- Reconnecting it changes live scoring behavior for every match audited
  from that point forward (more/different evidence, different treatments,
  different `evidence_family` provenance) across a wide set of metrics.
  That needs deliberate testing and sign-off, not a same-session, unverified
  wire-up.
- Deleting it destroys real engineering (a live WTA official API
  integration, a full PredixSport/DataHub warehouse, travel/weather/court
  context) that may be intended for reconnection later, or may already be
  planned for use elsewhere.

Flagging this here rather than picking a side. Whoever owns this
codebase's roadmap needs to say which one, and light architectural review
work (confirming exactly what evidence quality/quantity would change on
reconnection, or confirming it's genuinely superseded before deletion)
should happen before either.
