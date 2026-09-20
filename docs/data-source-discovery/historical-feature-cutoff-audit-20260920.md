# Historical feature and cutoff audit — 2026-09-20

## Scope and decision

This is a code-level audit of the current historical scoring path, the user-facing
`predictionSnapshot` path, and the Parlay Builder backfill path. It does not run a replay,
reset state, call a provider, write database data, or certify a holdout.

**Decision: no historical replay path is universally certified.** The dedicated historical
scorer and Parlay Builder backfill have strong pre-match row cutoffs, but the user-facing
snapshot path is not suitable for historical replay. A cutoff on `runPredictionEngine` alone
is not sufficient: every upstream history, ranking, odds, weather, calibration, cache, and
specialist input must be independently bounded or explicitly unavailable.

## Cutoff semantics

### Dedicated historical Prediction Engine scoring

`artifacts/api-server/src/services/historicalData/matchRecordReconstruction.ts`

- `reconstructPlayerMatchHistory` (approximately lines 87–108) keeps only rows with
  `scheduledStartAt < beforeCutoff`.
- `reconstructHeadToHead` (approximately lines 111–133) applies the same strict
  `scheduledStartAt < beforeCutoff` boundary.
- Cancelled rows and rows without a winner are excluded while building the historical index
  (`buildMatchHistoryIndex`, approximately lines 20–33).
- `artifacts/api-server/src/services/evaluation/historicalScoring.ts`
  `scoreHistoricalMatch` (approximately lines 99–164) consumes those bounded histories and
  passes `match.cutoffAt` as the engine's `asOfDate`.
- It intentionally supplies `weather: null` and `simulatorAdoption: null`; historical weather
  and current simulator adoption are not fabricated.
- It returns no score when surface/format is missing or either player has no pre-cutoff
  history (approximately lines 112–118).

This is the strongest historical path in the current codebase, but it still depends on the
caller constructing a correct `cutoffAt`, on the historical corpus being complete, and on
run-scoped calibration/specialist policy. The engine itself is not a universal cutoff guard.

### Parlay Builder backfill

`artifacts/api-server/src/services/parlayBuilder/builderScoringService.ts`

- `BuilderSnapshot.asOfDate` (approximately lines 43–67) enables backfill mode.
- `buildHistorySQL` (approximately lines 414–438) applies
  `scheduled_start_at < asOfDate` and a two-year lower bound.
- The cutoff is passed through direct-ID, identity-index, name-index, and DB-name-search
  resolution branches (approximately lines 647–757).
- `applyStalenessSupplementIfNeeded` is disabled when `asOfDate` is set; provider staleness
  supplementation and live layer 5 are not used in backfill (approximately lines 591–628,
  774–783).
- Web research and live odds fetching are skipped in backfill (approximately lines 1063–1087
  and 1185–1186, plus the web-research handling around lines 1589–1622).
- Missing or thin modules produce `limited`/`unavailable` factors rather than silently
  substituting current provider data.

Historical odds are only eligible when stored quote provenance proves the quote time was at or
before the match cutoff. A numeric odds value without a quote timestamp/source cannot satisfy
that requirement and is therefore ineligible for the odds feature.

## Feature audit

| Feature | Dedicated historical scorer | Parlay backfill | User-facing `predictionSnapshot` | Leakage risk / eligibility decision |
|---|---|---|---|---|
| Ranking | Historical rows retain provider rank fields at import; `minimalProfile` in `historicalScoring.ts` deliberately sets `currentRank: null`. | Historical DB rank columns are read by bounded SQL and used as stored row evidence. | `enrichPlayerRankFromSearch` in `predictionSnapshot.ts` (approximately lines 126–131) performs current provider enrichment. | Current/listing rankings are not proven as-of-match. Eligible only with a timestamped historical snapshot; otherwise unavailable/ineligible. |
| Overall Elo | `resolveOpponentStrengthFromIndex` uses the pre-cutoff reconstructed history and run-scoped Elo index (`historicalScoring.ts`, approximately lines 120–121). | Computed from the bounded DB rows and historical opponent/rank fields. | `resolveOpponentStrength(player1Matches/player2Matches)` uses provider-fetched lists with no historical cutoff. | Historical scorer/backfill are conditionally safe; snapshot path is not approved. |
| Surface Elo | `computeSurfaceEloModule` receives bounded `MatchRecord[]` from `historicalScoring.ts` and the match surface. | Computed from bounded rows; missing surface yields limited/unavailable behavior. | Receives current provider histories. | Safe only when source rows are bounded and surface is known; snapshot path ineligible. |
| Serve/return | `computeServeReturnModule` consumes bounded set-game/stat evidence. Provider rows without supported stats remain explicit unavailable. | Uses bounded `game_margins_player1`; no set-margin evidence produces a limited/unavailable factor. | Uses current provider match history. | Safe only with pre-cutoff evidence; no current fallback. |
| Recent form | `computeRecentFormModule` consumes reconstructed pre-cutoff histories. | Uses bounded two-year SQL history. | Uses current provider histories. | Historical scorer/backfill conditionally safe; snapshot path ineligible. |
| H2H | `reconstructHeadToHead` is strictly before cutoff; `historicalScoring.ts` passes the result to the engine. | H2H rows are bounded by `asOfDate`; sparse H2H becomes limited/neutral. | `getHeadToHead` is fetched from the current provider without a cutoff. | Dedicated/backfill paths conditionally safe; snapshot path ineligible. |
| Fatigue/recovery | `runPredictionEngine` receives `asOfDate: match.cutoffAt`; fatigue and match-load recovery measure windows from that date. | Bounded historical rows feed the same module family. | `runPredictionEngine` is called without `asOfDate`; wall-clock behavior can apply. | Safe only on the dedicated historical path; snapshot path ineligible. |
| Injury/availability | Historical scorer derives availability from bounded match evidence and supplies no current web research. | Bounded rows provide recorded retirements/rest; absent pre-match injury feed remains unavailable. | `predictionSnapshot` resolves current provider data and current weather/research inputs; no historical injury snapshot exists. | Recorded historical availability can be used; current injury/research data is ineligible. |
| Weather | Explicitly `null` in `scoreHistoricalMatch`; no archived weather source is claimed. | No historical weather source is supplied in backfill. | `getUpcomingConditions` is called for the scheduled start when enabled. | Historical weather is unavailable unless an archived, timestamped source is added; snapshot weather is not replay-safe. |
| Tournament state/experience | Tournament metadata and experience derive from bounded historical records where present. | Bounded rows and supplied tournament context feed the builder modules; missing metadata remains limited. | Snapshot receives current resolved profiles and live context. | Eligible only from bounded historical tournament evidence; current context is not eligible. |
| Odds/market | Historical scorer omits market odds. | Stored odds may be used only with quote-time provenance `<= cutoff`; absent provenance is ineligible. | `fetchMarketOddsWithStatus` performs a live odds lookup. | Live odds and un-timestamped stored odds are ineligible for replay. |
| Web research | Suppressed by the historical scorer and by `runPredictionEngine` whenever `asOfDate` is present. | Explicitly skipped in backfill. | Not a historical source; any current research is ineligible. | Current web research must never enter historical scoring. |
| Calibration | Walk-forward uses run-scoped historical calibration policy; shadow replay may use an artifact resolved as-of the match cutoff. | `getActiveCalibration` is a current cache in live mode; a backfill must provide a timestamped historical calibration artifact. | `getActiveCalibration` uses the current active/cache state. | Current active calibration is not historical evidence. Use only prior, timestamped artifacts or leave unavailable. |
| Specialist state | Historical scoring documents previous-cycle specialist state; shadow replay suppresses today's specialist mapping. | Current specialist/cache state is not automatically as-of-match. | `resolveSegmentSpecialistInput` resolves current state. | Requires prior-cycle or timestamped historical artifact; current state is ineligible. |
| Simulator/adoption | Historical scorer supplies `simulatorAdoption: null`; it does not feed current adoption into replay. | No current adoption should be used in backfill. | `resolveSimulatorAdoption` reads current adoption state. | Current simulator adoption is ineligible; simulator output may remain display-only/unvalidated. |
| Caches | Historical reconstruction is preloaded from the historical corpus and filtered per match; it does not bypass the cutoff. | Staleness supplements and provider layers are disabled when `asOfDate` is set. | Calibration, specialist, simulator, provider, and weather caches can reflect current state. | A cache is not historical merely because it is cached. Every cache entry needs an as-of timestamp or must be unavailable. |

## User-facing snapshot path: not approved

`artifacts/api-server/src/services/evaluation/predictionSnapshot.ts`

`predictFromSnapshot` (approximately lines 84–223):

- resolves profiles through the current provider;
- enriches current rankings with `enrichPlayerRankFromSearch`;
- fetches current player histories and H2H via `getPlayerMatches` and `getHeadToHead`;
- resolves current calibration and specialist state;
- resolves current simulator adoption;
- may fetch upcoming weather;
- fetches live market odds; and
- invokes `runPredictionEngine` without an historical `asOfDate`.

Provider errors are intentionally softened to empty histories/null H2H for live resilience
(approximately lines 133–151), but that is not historical proof. Empty data is not equivalent to
an audited as-of cutoff. This path must not be used for historical replay.

`runPredictionEngine` itself (approximately lines 370–400 in
`artifacts/api-server/src/services/predictionEngine/index.ts`) correctly uses `asOfDate` for
fatigue/recovery and suppresses web research when supplied, but it cannot bound upstream arrays
or current provider lookups. A caller must construct bounded inputs before invoking it.

## Truth Engine separation

Truth Engine evidence completeness is an independent audit dimension. A match may be prediction
eligible while Truth evidence remains partially unavailable, for example with a verified winner
but unavailable PBP, injury, or weather evidence. Conversely, complete Truth evidence cannot make
an unresolved identity, missing outcome, future-feature read, or unapproved source prediction
eligible.

The Live Tennis eligibility gate therefore reports prediction eligibility separately and leaves
Truth Engine evidence completeness independent.

## Current conclusion

The dedicated historical scorer and Parlay Builder backfill have defensible cutoff mechanisms,
subject to source availability and timestamped artifact requirements. The user-facing snapshot
path is not safe for a historical replay. No feature-level certification, holdout freeze, reset,
or replay should proceed until the remaining source, identity, and cutoff gates are satisfied.
