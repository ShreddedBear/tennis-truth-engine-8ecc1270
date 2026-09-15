# PBP match-identity reconciliation: audit and resolver design

Companion to `PBP_SOURCE_LICENSE_AUDIT.md` and `PBP_PIPELINE_ARCHITECTURE.md`.
This is identity-resolution work only. Nothing here validates PBP tapes,
corroborates anything independently, or changes what "VERIFIED" means. The
existing `scripts/atp-pbp-source-overlap.py` and
`scripts/atp-pbp-parser-quality.py` outputs are untouched and remain
independently reproducible — everything in this document runs through new,
separate scripts.

## 1. Why tiers 1-4 of the originally-proposed priority list aren't reachable

ppaulojr's own README (quoted in `PBP_SOURCE_LICENSE_AUDIT.md`) documents its
columns exhaustively: `date, tournament name, tour, draw, server1, server2,
winner, pbp, score, adf_flag`. **No tournament ID, no player ID, no surface,
no location field exists anywhere in this source.** Confirmed by re-reading
the actual CSV headers fetched live. This means:

- Tier 1 (exact stable tournament ID) and tier 2 (canonical mapping via a
  shared ID) are **not reachable** — there is no ID on the ppaulojr side to
  map from.
- Tier 3 (tournament + year + location) and tier 4 (+ surface/date range) are
  **not reachable** — ppaulojr carries neither field.
- Tier 5 (fuzzy normalized name) is what the existing pipeline already does
  (`tny_ok`).
- **Tier 6 (a controlled alias table) is the only tier that can materially
  improve on tier 5 without new data**, and is this document's main
  contribution.
- Tier 7 (fuzzy-as-candidate-generation-only) is preserved as the fallback
  exactly as before — it is gated by independently-agreeing score+winner
  before it can resolve anything, same as it always was.

## 2. Tournament identity: the alias table, built from real evidence

**Methodology** (`scripts/mine-pbp-tournament-aliases.py`): for every ppaulojr
candidate that the existing, already-tested `find_best_hist_match` classifies
as failing for EXACTLY `['TOURNAMENT_MISMATCH']` (score and winner
independently agree; only the tournament name disagrees), record the
`(ppaulojr_name, hist_name)` pair.

**A single occurrence is not trusted.** This was proven necessary, not
theoretical: mining the raw disagreement set (before applying a frequency
threshold) surfaced entries like `'ShanghaiRolexMasters-ATPShanghai' ->
'Brisbane'` and `"InternazionaliBNLd'Italia-ATPRome" -> 'Stockholm'` —
genuinely unrelated tournaments where a player pair that met more than once
in the year happened to produce the same score+winner against the WRONG
meeting. **These were deliberately excluded**, not resolved. The table only
contains `(ppaulojr_name, hist_name)` pairs observed **2+ times** across the
combined 2012+2013 corpus (`--min-occurrences 2`, the default), and every
resulting entry was manually reviewed for real-world plausibility — all 19
normalized entries are well-known ATP tournaments' sponsor-name/city-name
variants (French Open=Roland Garros, Miami=Sony Ericsson/Sony Open,
Cincinnati=Western & Southern Open, Rome=Internazionali BNL d'Italia, etc. —
full table in `scripts/lib/match_identity_resolver.py`).

37 raw trusted pairs collapse to exactly 19 table entries after stripping
ppaulojr's own scraping artifacts (`.html` suffix, trailing `.`) — confirmed
by an automated check that every one of the 37 raw pairs is covered by the
19-entry table with no mismatches.

## 3. Player identity: root-cause categorization (not a resolver — see below)

This resolver does **not** attempt to fix player-name mismatches — the
dominant failure mode empirically was tournament identity (650/682 vs
608/350), and building a real player-identity resolver would need the actual
`canonical_players`/`player_aliases` tables, which live in
tennis-stats-engine's Postgres and are not queryable from this environment
(no `DATABASE_URL`). What follows is categorization only, from the two static
CSV corpora already fetched (`scripts/atp-pbp-player-identity-audit.py`).

| Category | 2012 | 2013 |
|---|---:|---:|
| G — both players individually exist in hist, but this exact pair never met per hist that year | 275 | 207 |
| A — one player entirely absent from hist that year | 244 | 114 |
| A — both players entirely absent from hist that year | 89 | 29 |
| B — spelling/diacritic difference | 0 | 0 |
| C — initials vs full name | 0 | 0 |
| D — married/name-change | not detectable from this data | not detectable |
| E — duplicate canonical player | not detectable from this data | not detectable |
| F — provider ID mismatch | N/A — neither source carries an ID | N/A |

**Real root causes found on manual inspection of sampled examples** (not
guessed):
- **Qualifying-round date-boundary bleed**: many "absent" and "G" examples
  are qualifying-round matches at tournaments whose main-draw event carries a
  `20111`-style prior-year suffix in ppaulojr's own filename, with match dates
  in the first days of January (e.g. `AircelChennaiOpen-ATPChennai20111`
  dated 2012-01-04/01-06; `QatarExxonMobilOpen-ATPQatar20111` dated
  2012-01-01/01-02). The Aneeshers/Sackmann hist file this pipeline fetches
  (`atp_matches_YYYY.csv`) is **main-draw only** — qualifying rounds live in a
  separate file (`atp_matches_qual_chall_YYYY.csv`) that this pipeline does
  not fetch. In a 10-example sample per category per year, this pattern
  accounted for 10/30 (2012) and 26/30 (2013) of examples checked — directional,
  not a full-population percentage, but a real, identifiable, systematic
  cause, not noise.
- **Doubles and Davis Cup rows**: ppaulojr's corpus contains rows like
  `'Colin Fleming/Ross Hutchins' vs 'Michal Mertinak/Filip Polasek'`
  (tournament: `DavisCup`) — doubles pairings and team-competition matches
  that do not belong in ATP main-tour **singles** PBP at all. These correctly
  fail to match (they are not singles matches), and no resolver should ever
  "recover" them. In the same 10-per-category sample: 11/30 (2012) and 3/30
  (2013) looked like doubles/Davis Cup by this heuristic (contains `/` in a
  player name, or tournament literally named `DavisCup`).
- **Zero spelling/diacritic or initials-only mismatches were found** in this
  categorization pass — meaning the "no historical pair" gap is NOT primarily
  a name-normalization problem; it's primarily a **scope mismatch** (matches
  that were never going to be in the ATP-main-singles hist file in the first
  place: qualifying rounds, doubles, team events).

**Answering the task's central question for this axis**: the ~608/350 "no
historical player pair" gap is mostly **not a fixable identity-matching bug**
— it is mostly matches that are out of scope for "ATP main tour singles" by
construction (qualifying, doubles, Davis Cup) plus a genuine but distinct
qualifying-round data-coverage gap (a different Sackmann file this pipeline
doesn't fetch). Recommend as a separate, explicitly scoped future task, not
folded into this identity resolver.

## 4. Match-level resolver architecture

```
PBP source (ppaulojr)
    |
IDENTITY RESOLUTION   <- scripts/lib/match_identity_resolver.py (NEW, this doc)
    |   uses ONLY p.score / p.winner (ppaulojr's own CSV-declared fields)
    |   -- NEVER reconstruct_pbp(p.pbp_tape)'s derived winner/score, which
    |      would be circular (using the tape to validate its own identity)
    |
    +-- player pair identity: pairkey() -- unchanged, exact
    +-- tournament identity: ALIAS_TABLE (tier 6, new) -> FUZZY_FALLBACK
    |   (tier 7, existing tny_ok, unchanged) -> UNRESOLVED
    +-- multiple qualifying candidates? -> AMBIGUOUS, ALL listed, NEVER auto-picked
    |
STRUCTURAL VALIDATION  <- reconstruct_pbp() -- UNCHANGED, runs only after
    |                     identity is RESOLVED (never for AMBIGUOUS/UNRESOLVED)
    |
INDEPENDENT CORROBORATION  <- still 0 (tennis-data.co.uk down) -- UNCHANGED
    |
VERIFICATION / PRODUCTION ELIGIBILITY  <- still 0 -- UNCHANGED
```

Identity resolution and PBP validation are two separate function calls in two
separate modules (`match_identity_resolver.py` vs `pbp_source_adapter.py`'s
`reconstruct_pbp`), enforced by a dedicated test
(`test_identity_never_uses_reconstructed_pbp_output`) that proves the
resolver's output is identical regardless of whether the tape is valid,
garbage, or absent.

## 5. Before/after results (real data, `scripts/atp-pbp-identity-resolution-experiment.py`)

| Category | 2012 Old | 2012 New | 2013 Old | 2013 New |
|---|---:|---:|---:|---:|
| internally validated | 1,318 | **1,919** | 1,525 | **2,146** |
| no historical player pair | 608 | 608 | 350 | 350 |
| tournament mismatch | 629* | 0 | 661* | 0 |
| score mismatch | 29 | folded into `unresolved_other` (29) | 28 | folded into `unresolved_other` (28) |
| structural failure | 61 | 89 | 84 | 124 |
| ambiguous | 0 | 0 | 0 | 0 |
| conflicts | 0 | 0 | 0 | 0 |

*This experiment's "old" counts are mutually exclusive per-candidate (one
bucket per candidate, priority order score>winner>tournament), which differs
slightly from `atp-pbp-parser-quality.py`'s union-of-all-reasons tally (650
tournament + 29 score + 9 winner, not mutually exclusive — a candidate could
carry more than one simultaneous reason there). Both are correct for what
they each measure; this table's "old" column is the internal baseline for
this specific before/after comparison, not a replacement for the original
parser-quality report.

**Recovered: 601 (2012) + 621 (2013) = 1,222.** **New ambiguities: 0. New
conflicts: 0.** Structural-failure counts rose (61→89, 84→124) because MORE
candidates now reach that check at all — previously they were rejected at the
tournament-identity stage before ever attempting structural validation. This
is the funnel working as intended, not a regression: these candidates were
always going to fail somewhere; they just failed one stage later, and are
correctly still not counted as validated.

**New grand total, internally validated: 1,919 + 2,146 = 4,065** (up from
2,843 — corrected total documented in this session's prior turn).

## 6. Manual audit sample (25 real recovered matches)

**Correction made during review**: an earlier draft of this table used
plausible-sounding but hand-written examples instead of actually pulling from
the committed experiment output. That was wrong for an audit document and has
been replaced with the real records below.

Drawn via `random.seed(42); random.sample(..., 25)` over the 100 real records
captured across both years' `recovered_examples_sample` fields in
`data/audit/pbp-identity-resolution-experiment/atp_main_{2012,2013}.json`
(each year's file captures up to 50 real recovered records, in fetch order —
not the full population of 1,222, but genuine committed data, not fabricated
or cherry-picked for this table). Every row was previously stuck at
`tournament_mismatch` and is now `internally_validated` via
`TournamentIdentityTier.ALIAS_TABLE`. **This is identity reconciliation
only — none of these are "verified PBP".**

| # | Players | ppaulojr tournament string | Resolved to | Date |
|---|---|---|---|---|
| 1 | Joao Sousa vs Daniel Gimeno-Traver | VTROpen-ATPVinaDelMar | Santiago | 2013-02-06 |
| 2 | Jo-Wilfried Tsonga vs Flavio Cipolla | QatarExxonMobilOpen-ATPQatar20111.html | Doha | 2012-01-04 |
| 3 | Dmitry Tursunov vs Albert Ramos | QatarExxonMobilOpen-ATPQatar20111 | Doha | 2012-01-02 |
| 4 | Horacio Zeballos vs Rafael Nadal | VTROpen-ATPVinaDelMar | Santiago | 2013-02-10 |
| 5 | Thomaz Bellucci vs Federico Delbonis | VTROpen-ATPVinaDelMar. | Santiago | 2012-02-02 |
| 6 | Nicolas Massu vs Federico Del Bonis | VTROpen-ATPVinaDelMar. | Santiago | 2012-01-31 |
| 7 | Paul Capdeville vs Igor Andreev | VTROpen-ATPVinaDelMar. | Santiago | 2012-01-31 |
| 8 | Denis Gremelmayr vs Rafael Nadal | QatarExxonMobilOpen-ATPQatar20111.html | Doha | 2012-01-04 |
| 9 | Matthias Bachinger vs Viktor Troicki | QatarExxonMobilOpen-ATPQatar20111.html | Doha | 2012-01-04 |
| 10 | Horacio Zeballos vs Pablo Andujar | VTROpen-ATPVinaDelMar | Santiago | 2013-02-07 |
| 11 | Nikolay Davydenko vs Simone Bolelli | QatarExxonMobilOpen-ATPQatarLive | Doha | 2013-01-03 |
| 12 | Nikolay Davydenko vs Roger Federer | QatarExxonMobilOpen-ATPQatar20111 | Doha | 2012-01-03 |
| 13 | Filippo Volandri vs Leonardo Mayer | VTROpen-ATPVinaDelMar | Santiago | 2013-02-04 |
| 14 | Richard Gasquet vs Jan Hernych | QatarExxonMobilOpen-ATPQatarLive | Doha | 2013-01-01 |
| 15 | Igor Kunitsyn vs Benjamin Becker | QatarExxonMobilOpen-ATPQatar20111 | Doha | 2012-01-02 |
| 16 | Gilles Muller vs Paolo Lorenzi | BNPParibasOpen-ATPIndianWells | Indian Wells Masters | 2013-03-07 |
| 17 | Daniel Gimeno-Traver vs Albert Montanes | VTROpen-ATPVinaDelMar.html | Santiago | 2013-02-07 |
| 18 | Santiago Giraldo vs Leonardo Mayer | VTROpen-ATPVinaDelMar. | Santiago | 2012-01-30 |
| 19 | Frederico Gil vs Paolo Lorenzi | VTROpen-ATPVinaDelMar. | Santiago | 2012-01-31 |
| 20 | Viktor Troicki vs Lukas Lacko | QatarExxonMobilOpen-ATPQatarLive | Doha | 2013-01-02 |
| 21 | Pere Riba vs Tommy Robredo | VTROpen-ATPVinaDelMar | Santiago | 2013-02-05 |
| 22 | Carlos Berlocq vs Santiago Giraldo | VTROpen-ATPVinaDelMar | Santiago | 2013-02-06 |
| 23 | Richard Gasquet vs Daniel Brands | QatarExxonMobilOpen-ATPQatarLive | Doha | 2013-01-04 |
| 24 | Jo-Wilfried Tsonga vs Gael Monfils | QatarExxonMobilOpen-ATPQatar20111.html | Doha | 2012-01-07 |
| 25 | Tommy Robredo vs Paolo Lorenzi | VTROpen-ATPVinaDelMar.html | Santiago | 2013-02-07 |

Two real, verifiable events dominate this particular random draw (Doha /
Qatar ExxonMobil Open, and Viña del Mar / VTR Open — both real ATP 250-level
events whose sponsor names changed across ppaulojr's own files, exactly the
kind of variant the alias table exists to catch) — this reflects the actual
composition of the captured sample, not a selection choice; row 16 is the
only Masters-1000-level example in this particular draw (Indian Wells). All
25 are plausible real players active on tour in the given season at the
correctly-identified event. I did not independently verify each individual
match result against an outside record (that would itself require the
missing independent-corroboration source this whole pipeline is blocked on) —
this table demonstrates identity reconciliation only. Whether each tape's own
point sequence is structurally valid is the separate, unchanged
`reconstruct_pbp` check; independent corroboration remains blocked (0, as
always).

Separate "25 recovered player-identity matches" and "25 recovered full match
identities" samples were not produced as distinct sets: this resolver's ONLY
change is on the tournament-identity axis (player-pair matching via
`pairkey()` is exact and unchanged), so every tournament-identity recovery
in this dataset is simultaneously a full-match-identity recovery — there is
no separate population of player-identity-only recoveries to sample, since
no player-identity resolver was built this pass (see section 3).

## 7. Specific tournament tests (Miami, Indian Wells, Cincinnati)

All three, plus the naming-convention variance between 2012 and 2013 (e.g.
Miami: `SonyEricssonOpen` in 2012 vs `SonyOpenTennis` in 2013 — a real
sponsor-name change ppaulojr's data reflects), are covered by dedicated
passing unit tests in `match_identity_resolver.test.py`'s
`TestSpecificTournaments` class, run against both the isolated resolver logic
and confirmed present in the real corpus mining output (both years' `x57`/`x79`
Miami counts, `x47`/`x70` Indian Wells, `x54`/`x32` Cincinnati). WTA
corroboration gaps mentioned in the task were not independently re-examined
this pass — WTA is out of this session's ATP-only scope.

## 8. Cross-year safety

Proven by three tests in `TestCrossYearSafety`:
1. Table values are pure canonical names, never year- or match-specific (so
   the same entry is safely reusable across any year).
2. The same tournament-name string correctly resolves against only its own
   year's hist candidates (simulated: a 2012 candidate is only ever compared
   against 2012 hist rows, a 2013 candidate only against 2013 rows — this is
   also true architecturally, since `AneeshersSackmannHistAdapter.fetch_year`
   and `PpaulojrPbpAdapter.fetch_year` are always called for the same single
   `year` argument together, never mixed).
3. A same-name, same-players candidate with a genuinely different (real)
   score for a different year's meeting correctly resolves as UNRESOLVED, not
   as a false match — score/winner disagreement blocks resolution regardless
   of name or player similarity.

## 9. Sackmann-lineage impact areas (Task 11 — documented, not remediated)

Extending `PBP_PIPELINE_ARCHITECTURE.md`'s Phase 4 with the specific
mechanism of impact in each area, confirmed by direct code inspection
(tennis-stats-engine):

- **Calibration**: `calibration.ts`'s `WINNER_ALWAYS_PLAYER1_PROVIDERS`
  explicitly includes `"sackmann"`, actively changing how these rows are
  re-oriented before being included in the PAVA calibration fit. Sackmann
  rows are training data for the live calibrated-probability curve.
- **`historical_matches`**: rows exist with `provider = 'sackmann'`
  (~276,677 per the dated 2026-08-10 comment) commingled with all other
  providers, no partition or flag distinguishing them.
- **Feature generation**: `opponentStrength.ts` and `compositeProvider.ts`
  both reference Sackmann-bridged player IDs directly when resolving alias
  groups for opponent-strength and Elo-adjacent computations — Sackmann rows
  are read like any other provider's rows when computing features for a
  match.
- **Backtesting**: not directly re-traced this pass beyond confirming no
  provider-based exclusion exists anywhere in the codebase (grepped;
  `backtestRuns`/`backtestPredictions` tables were not individually opened) —
  flagged as an open item for whoever does the eventual remediation, since
  backtests likely draw from the same `historical_matches` table.
- **Prediction**: since calibration (which sits directly in the live
  prediction path) is trained partly on Sackmann rows, every live prediction
  is at minimum indirectly shaped by this data, even for matches that have
  nothing to do with Sackmann-sourced players.
- **Model training**: `walkForward.ts` references Sackmann's specific
  winner/player1 labeling convention directly (line 411: "Sackmann stores the
  winner as player1 in ~90% of rows") when constructing its own training
  rows — this is a structural dependency on Sackmann's data shape, not just
  incidental row presence.

This is documentation only, as instructed. No rows were deleted, migrated, or
modified. No `DATABASE_URL` was available to re-confirm the exact current row
count; the SQL to do so is given in `PBP_PIPELINE_ARCHITECTURE.md`.
