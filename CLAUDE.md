# Claude Code Handoff

## Resume point

- Destination repository: `ShreddedBear/tennis-truth-engine-8ecc1270`
- Branch: `claude/tennis-engine-audit-32-razn75`
- Phase 2 verification/closure commit: `f49a0631`
- A later automatic generated-data commit exists: `4d1aecc8`
  - It was created when the Truth Engine workflow regenerated:
    - `artifacts/tennis-truth-engine/data/generated/tennis-runtime-index.json`
    - `artifacts/tennis-truth-engine/public/generated/tennis-runtime-index.json.gz`
  - Do not reset it merely to make `f49a0631` the branch tip.
- Read the current `HEAD` after checkout; this handoff file is committed after `4d1aecc8`.
- Local and remote heads matched at `f49a0631` before the generated-data and handoff commits.
- The working tree was clean when this handoff was prepared.

## Project status

- Phase 1 forensic audit is complete.
- Phase 2 implementation is complete.
- Phase 2 final verification and safe gap closure are complete at `f49a0631`.
- Do not repeat the forensic audit.
- Do not perform another repository migration or consolidation.
- Remaining work is limited to final verification and correctness gaps documented below.

## Hard constraints

- The repository is consolidated, but these three engines must remain separate:
  1. Truth Engine
  2. Prediction Engine
  3. Parlay Builder
- Preserve engine ownership and data-flow boundaries.
- `heliumdb` is the operational database.
- Do not reset, rebuild, replace, or broadly backfill the database.
- Do not rewrite historical database rows unless the user separately and explicitly authorizes it.
- Database investigation should be read-only by default.
- Do not add unapproved tennis-data providers. Approved source order is existing DB, approved Sackmann archives, approved point-by-point sources, then Live Tennis API. Existing API-Tennis, RapidAPI/MatchStat, and Sofascore integrations may only be used within their current approved roles.
- Do not change the official Prediction Engine probability using betting-market odds. Odds remain available for value, audit, ablation, and parlay analysis.

## What Phase 2 closed

- All five Truth Engine TypeScript errors were fixed without weakening strict typing.
- Truth decision-record and refusal-forensics fixtures were aligned with the weighted-family model.
- Historical Builder scoring rejects null-dated rows because their pre-cutoff existence cannot be proven.
- Live Builder scoring may retain null-dated rows.
- The standalone Builder outcome backfill now writes matchup closeness, removal probability, and all six calibration/provenance columns.
- Every known Builder outcome writer is covered by a source-contract test for the six provenance columns.
- Builder calibration provenance no longer incorrectly says durable persistence is deferred.
- Forensic reliability accepts string or numeric input and normalizes it at the boundary.

## Verified repository state

- All 12 expected Phase 2 commits are ancestors of `f49a0631` and were verified on the remote branch:
  - `d670af21`
  - `3904ab20`
  - `51b43117`
  - `3e0c2858`
  - `8d1fc61d`
  - `d0e391ac`
  - `d253686a`
  - `83d840dd`
  - `d7c6f037`
  - `b4576f57`
  - `bb8ae21d`
  - `d488102c`
- `3a9384b4` contains the previously untracked Phase 2 reconciliation plan attachment and is intentionally in branch history.
- `f49a0631` is the final implementation/verification closure commit.

## Verification already completed

Passed:

- `pnpm run typecheck`
- Prediction Engine test suite: 221 passed
- Tennis-data suite: 95 passed
- Builder scoring/calibration/boundary suite: 126 passed
- Historical leakage suite: 9 passed
- Incremental historical-backfill suite: 2 passed
- Focused Phase 2 Truth suite: 41 passed
- API Server workflow builds and starts.
- Truth Engine workflow builds its runtime index and starts.
- Tennis Predictor and Truth Engine render through Replit preview.

Do not rerun expensive broad suites merely to reproduce these results. Run the smallest relevant command after a code change.

## Database preservation checkpoint

Read-only verification against `heliumdb` showed:

- `historical_matches`: 530,097
- `match_feature_snapshots`: 2,578,706
- `parlay_leg_outcomes`: 555
- `builder_calibration_models`: 0
- Existing outcome rows with any of the six new provenance fields populated: 0
- All six nullable provenance columns exist.

The running paper-trading service legitimately adds current `evaluation_predictions`; do not mistake that expected growth for a historical rewrite. Inspect `run_kind`, `prediction_mode`, fixture IDs, and timestamps before considering any cleanup. Do not delete rows without explicit proof and authorization.

## Engine-boundary conclusions

### Parlay Builder

- The independent `/validate` scoring path, `builderScoringService`, and Builder-owned calibration do not consume Prediction Engine probabilities or calibration.
- Do not claim the entire Builder route/runtime surface is Prediction-independent.
- Legacy evaluation, engine-agreement, historical grading, backtest, and analytics routes intentionally read `predictions` or `evaluation_predictions`.
- Accurate statement: Builder scoring/calibration is independent; comparison, settlement, and analytics surfaces are not zero-dependency.

### Prediction Engine

- Remains the owner of official match probability.
- Market odds must not alter that official probability.

### Truth Engine

- Uses weighted evidence families.
- Evidence coverage is diagnostic and must not be represented as win probability.
- Actual match winner remains the calibration target.
- Point-by-point evidence must preserve strict reconstruction and provenance; do not invent missing point winners.

## Provider-routing conclusions

- Fixture acquisition order is:
  1. Live Tennis API
  2. API-Tennis
  3. RapidAPI/MatchStat
  4. Sofascore
- Empty responses continue to the next fixture provider.
- History routing has its own provider order and diagnostics.
- Live-score lookup currently relies on API-Tennis:
  - native event-key lookup for API-Tennis fixtures
  - exact date plus ordered-player-name identity correlation for non-native fixtures
- There is no implemented secondary live-score provider fallback.
- Do not claim a fallback exists or invent one without confirming an approved provider actually supports live scores.

## Remaining correctness gaps

### 1. Provider tests depend on live internet

`builderProviderFetch.test.ts` has eight failures when Wikidata/provider services return 403 or rate-limit responses. The scoring/calibration/boundary tests are green. Fix by mocking every external boundary and preserving explicit 401, 403, 429, empty, not-found, and data-found cases.

### 2. Full Truth Engine suite is not green

Truth now typechecks and focused Phase 2 tests pass, but broad tests retain pre-weighted assumptions. Failures were observed in:

- `truth-engine-decision.test.ts`
- `truth-engine-immutability-inversion.test.ts`
- `truth-engine-stage-mapping.test.ts`
- `audit-pipeline.test.ts`
- evidence-coverage production-proof tests
- `api-key-auth.test.ts` repository-hygiene assumptions

Update stale fixtures to current production semantics. Do not weaken weighted-family, symmetry, refusal, evidence-firewall, or audit behavior to satisfy old assertions.

### 3. Full evaluation suite exceeds the command limit

The bridge-rescore test spent about 298 seconds building the complete historical Elo index, causing the combined evaluation command to exceed five minutes. Split slow tests or introduce a deterministic fixture/index boundary rather than repeatedly running the complete live-sized history.

### 4. Live-score fallback is incomplete

- Add a fallback only after confirming an approved provider exposes real live-score capability.
- Add direct tests for API-Tennis event-key filtering, score mapping, date window, ordered identity correlation, reversed order, ambiguity, and caller-ID preservation.
- Expose score-routing diagnostics even if score lookup occurs before fixture acquisition.

### 5. Same-timestamp historical ordering

Future-dated and null-dated historical rows are excluded correctly. Matches sharing the exact timestamp may still be processed sequentially, allowing lexical order to affect running state. A safe fix likely requires grouped processing by timestamp and may affect historical recomputation. Treat this as non-trivial; do not silently rewrite stored history.

### 6. Builder calibration semantics

- Calibration currently pools all resolved historical and live Builder outcomes.
- It is not strict walk-forward calibration.
- Provenance does not record training cutoff, row population, or source composition.
- `getActiveBuilderCalibration` refits on cache miss instead of loading the active registry row.
- Registry persistence failure is non-fatal.
- Decide and document whether pooled calibration is intentional before changing it.
- Do not retroactively populate the 555 existing outcome rows without authorization.

### 7. Builder schema test depth

The source-contract test verifies that all writers mention all six provenance columns, but no database integration test proves SQL column/value positional parity, registry integrity constraints, or active-model read behavior.

### 8. WTA/ATP evidence parity

Runtime index generation currently reports ATP, WTA, ATP Challenger, WTA 125, and WTA Main coverage. Remaining work concerns deeper point-by-point evidence and verification parity, not basic WTA availability.

## Useful commands

```bash
# Canonical typecheck
pnpm run typecheck

# Focused Builder scoring/calibration tests
pnpm --filter @workspace/api-server exec tsx --test \
  src/services/parlayBuilder/builderCalibration.test.ts \
  src/services/parlayBuilder/builderScoringService.test.ts

# Builder boundary
pnpm --filter @workspace/api-server run test:parlay-boundary
pnpm --filter @workspace/api-server run check:parlay-boundary

# Historical temporal checks
pnpm --filter @workspace/api-server run test:leakage
pnpm --filter @workspace/api-server run test:historicalBackfillIncremental

# Focused Truth verification
pnpm --filter @workspace/tennis-truth-engine exec vitest run \
  src/lib/source-observation-metric-bridge.test.ts \
  src/lib/bsd-wta-main-pbp.refusal.test.ts \
  src/lib/pbp-evidence-firewall.test.ts \
  src/lib/truth-engine-decision-record.test.ts \
  src/lib/truth-engine-only-25-active-vote.test.ts \
  src/lib/truth-engine-refusal-forensics.test.ts
```

Use managed Replit workflows rather than running root-level `pnpm dev`.

## Before making changes

1. Confirm the checked-out branch and current `HEAD`.
2. Confirm the working tree is clean.
3. Read this file and the relevant implementation/tests only.
4. Do not start a new broad audit.
5. Choose one remaining correctness gap and make the smallest safe change.
6. Run focused verification, then the canonical typecheck if TypeScript changed.
7. Preserve database and engine boundaries.