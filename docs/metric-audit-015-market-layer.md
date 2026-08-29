# Metric 015 — Market Layer — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

**First audit for this code.** `docs/evidence-coverage/81-metric-recoverability-audit.md`
previously labeled code 015 "Market View" and classified it TRULY
UNAVAILABLE ("no broad raw odds_api MARKET observation set was confirmed
in production"). That claim turns out to be wrong for the live wiring:
`deterministic-market-metrics.server.ts` already queries a real,
production `odds_api`/`MARKET`-typed `source_observations` feed (The Odds
API), live-wired since before this session. This is the first audit
written against the real definition and the real wiring.

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 15.

Required submetrics:
- Sportsbook Moneyline Consensus
- Multiple-Book Comparison
- Opening Price vs Current/Closing Price
- Market Movement
- No-Vig Implied Probability
- Model-vs-Market Divergence
- Prediction-Market Consensus

## 2. Permitted raw inputs
Paired bookmaker decimal-odds snapshots for both players, each carrying a
snapshot timestamp and bookmaker identity, for the specific match date.
Model-vs-Market Divergence additionally needs this project's own model
probability to compare against — importing TennisMatrixAi's own computed
probability for this purpose would make Truth Engine's audit of
TennisMatrixAi circular and is out of scope by design (see the
market/odds-integration boundary already established for this project:
only a raw third-party odds feed is shared between the two projects,
never TennisMatrixAi's own computed outputs). Prediction-Market Consensus
needs a genuinely different data source (prediction markets, not
sportsbooks) not currently ingested anywhere.

## 3. Sources inspected
- `src/lib/deterministic-market-metrics.server.ts` (`deterministicMarketMetric`, `summarizeMarket`, `deVigForPlayer`, `movement`) — the live, production, per-request engine. Queries `source_observations` where `source_id = "odds_api"` and `observation_type = "MARKET"`, filtered to the exact match `event_date`.
- `src/lib/deterministic-market-metrics.test.ts` and `src/lib/deterministic-market-metrics-certification.test.ts` — existing coverage; found an explicit `isCoreMarket = code === "015" || code === "019"` → `"RECONSTRUCTED"` assertion (see §5) whose own comment undercounted 015's real definition to only 3 of its 7 named bullets.
- `src/lib/metric-certification.ts` — confirmed 015 has no registered `CERTIFIED_METRIC_POLICIES` entry, so `certifyMetricFinding` passes its treatment through unchanged (unlike 019).

## 4. P1/P2 orientation
`loadSide(player, opponent, matchDate, tournament)` is called once per side (`args.p1, args.p2` then `args.p2, args.p1`), each filtered via `evidencePairMatches` to that side's own identity; `summarizeMarket(rows, opponentRows)` and `deVigForPlayer` compute each side's own de-vig probability using the paired opponent snapshot at the same timestamp/bookmaker, not a mirrored shortcut.

## 5. Treatment classification

**Owner decision made this pass, same pattern as metrics 001 and 014's
resolution.** Changed from `RECONSTRUCTED` to `PARTIAL`. Rationale: this
project's own house rule defines RECONSTRUCTED as requiring "every
required component of the exact definition/formula." Only 3 of code 015's
7 named bullets are genuinely covered by this engine (see §6);
Multiple-Book Comparison, Model-vs-Market Divergence, and Prediction-
Market Consensus are missing entirely. The existing test's own comment
justifying RECONSTRUCTED cited only 3 bullets as "015's own definition" —
an incomplete reading of the real 7-bullet catalog entry, not a
considered decision to treat the other 4 as out of scope.

Blast-radius check before changing it: `deterministic-market-metrics.test.ts`
explicitly asserted the literal source text
`const isCoreMarket = code === "015" || code === "019"` — updated to
`code === "019"` only, with a comment explaining 019 stays because
`certifyMetricFinding`'s registered policy downgrades its output
regardless (unaffected by this change; confirmed via
`deterministic-market-metrics-certification.test.ts`'s existing 019 case,
also unchanged). `deterministic-market-metrics-certification.test.ts`'s
015 case updated to test the pass-through behavior with a PARTIAL input
(matching the engine's new real output) rather than asserting the engine
itself should still emit RECONSTRUCTED. No other test file references
code 015's treatment (checked via grep). Full test suite passes after the
change. 043/044 (also on this file's `MARKET_CODES` set) were already
PARTIAL before this pass and are unaffected.

## 6. Reconstruction/formula verification
- `avg_raw_implied_probability` (`avg_raw` in the value text) — mean of `1/decimal_odds` across all paired bookmaker snapshots for the event — matches "Sportsbook Moneyline Consensus: the average implied win probability across multiple sportsbooks."
- `avg_devig_probability` (`avg_de_vig`) — mean of `p/(p+q)` for each timestamp/bookmaker-matched pair of both sides' implied probabilities — matches "No-Vig Implied Probability" exactly (removes the bookmaker's margin by normalizing the pair to sum to 1).
- `probability_movement` (`move`) — last-minus-first implied-probability delta across the event's own ordered snapshots — matches "Market Movement: the direction and magnitude of line movement leading up to the match," and the same first/last-snapshot computation honestly satisfies "Opening Price vs Current/Closing Price" too (both bullets reduce to the same first-vs-last observed price in this single-event window; not double-counted as two separate formulas, just one computation that happens to answer both bullets).
- No formula anywhere computes a per-bookmaker side-by-side breakdown (`bookmakerKey` is used only internally to pair odds for de-vig, never surfaced as its own comparison output), a divergence against this project's own model probability, or anything sourced from a prediction market rather than a sportsbook.

## 7. Provenance/sample/persistence
`sources: [{ source_name: sourceName, url: sourceUrl }]` preserves the row's own `source_name`/`source_url` (The Odds API); `sample` states the exact match date, tournament, tour family, and per-side observation counts. Unaffected by this pass except the new `unavailable_reason` text.

## 8. Cross-wiring audit
`MARKET_CODES = new Set(["015", "019", "043", "044"])` — confirmed this file only ever returns a finding for these four codes; no cross-wiring into unrelated codes found. 019 keeps its own separate, registered `certifyMetricFinding` policy (downgrades its current-odds-only output to UNAVAILABLE, unaffected by this pass); 043/044 remain PARTIAL as before.

## 9. Legitimate unavailable-data recovery
Recovered/confirmed:
- Sportsbook Moneyline Consensus, No-Vig Implied Probability, and Market Movement/Opening-vs-Closing-Price all have genuine, correctly-oriented, provenance-carrying evidence from a real, live, production odds feed.

Still SOURCE REQUIRED:
- Multiple-Book Comparison — needs a per-bookmaker side-by-side output, not just an aggregate mean/median.
- Model-vs-Market Divergence — needs this project's own model probability; deliberately not sourced from TennisMatrixAi's outputs (would make the audit circular).
- Prediction-Market Consensus — needs a prediction-market data source, not currently ingested.

## 10. Regression protection
`src/lib/deterministic-market-metrics.test.ts` and
`src/lib/deterministic-market-metrics-certification.test.ts` updated in
place (existing files) to assert the corrected `isCoreMarket` scoping and
PARTIAL treatment, each with a comment pointing back here.

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence inflation;
the underlying odds data and formulas were already genuine and correctly
sourced — only the treatment label was over-claimed relative to the real
7-bullet definition.
