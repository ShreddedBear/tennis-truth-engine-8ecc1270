# Independent corroboration: interface, source-family model, and honest experiment status

Companion to `MATCH_IDENTITY_RESOLVER.md`. **No record in this document is
promoted to LEVEL_1_VERIFIED, MATCH_CORROBORATED, or PBP_CORROBORATED.** The
4,065 internally-validated records from the identity-resolution phase remain
at `STRUCTURALLY_VALIDATED` only — see the exact state breakdown in section 6.

## 1. Corroboration interface (built, this commit)

`scripts/lib/corroboration_source.py`: `CorroborationSource` (ABC,
`lookup(player1, player2, year, tournament_hint) -> list[CorroborationRecord]`),
`CorroborationRecord` (source, source_family, source_record_id, tournament,
date, round, surface, player1, player2, winner, score, provenance,
retrieved_at, license_status, commercial_eligibility, optional pbp_tape),
and `corroborate_match()` which never silently resolves ambiguity
(`CorroborationOutcome`: CORROBORATED / NOT_FOUND / CONFLICT / AMBIGUOUS /
SOURCE_ERROR / NOT_INDEPENDENT). A corroborator does not need to supply PBP —
`pbp_tape` is optional on the record, exactly as specified.

`scripts/lib/verification_status.py`: the 6-state validation model
(CANDIDATE → STRUCTURALLY_VALIDATED → MATCH_CORROBORATED → PBP_CORROBORATED,
plus CONFLICT / REVIEW_REQUIRED) combined with the existing license-status
axis into `RecordStatus.production_status`. Enforces by construction that
`STRUCTURALLY_VALIDATED + MATCH_CORROBORATED` does not imply
`PBP_CORROBORATED` (`pbp_corroborated_from(match_corroborated=True,
independent_pbp_agrees=None)` returns `MATCH_CORROBORATED`, not a guess in
either direction — see the dedicated test for this exact relationship).

`scripts/lib/pbp_normalization.py`: canonical point-sequence representation
and `compare_point_sequences()` for cross-provider PBP-level comparison,
handling the documented difference classes (server/point notation, tiebreak
serve-change markers, set/game separators, ace/double-fault vs plain points).
**Built and unit-tested against synthetic alternate-encoding fixtures only**
— see section 4's honest disclosure.

45 new tests across the three modules (12 + 12 + 9, plus 12 for the
`RecordStatus`/`match_corroborated_from`/`pbp_corroborated_from` functions —
see exact counts in the commit), all passing.

## 2. Source-family / independence analysis

`SourceFamily` enum and `is_independent()`:

| Family | Members | Independent of ppaulojr/Sackmann-hist? |
|---|---|---|
| `SACKMANN_COMPILED` | JeffSackmann's own repos, Aneeshers mirror, farhadGithub mirror, any other GitHub republication of the same compiled dataset | **No** — this is the identity-resolution hist source itself |
| `PPAULOJR_COMPILED` | ppaulojr/tennis_pointbypoint | **No** — this is the PBP candidate source itself |
| `OFFICIAL_TOUR` | atptour.com, wtatennis.com | Yes |
| `TENNIS_DATA_CO_UK` | tennis-data.co.uk | Yes |
| `COMMERCIAL_API_TENNIS` | api.api-tennis.com | Yes |
| `COMMERCIAL_MATCHSTAT_RAPIDAPI` | tennis-api-atp-wta-itf.p.rapidapi.com | Yes |
| `COMMERCIAL_SPORTRADAR` | Sportradar Tennis API | Yes |
| `UNKNOWN` | anything not yet classified | **Never independent** — forces explicit classification before use |

`is_independent()` checks a candidate against BOTH the PBP source's family
AND the hist/identity source's family — corroborating a ppaulojr-sourced,
Sackmann-hist-identity-resolved candidate against another Sackmann-family
mirror (however differently named or hosted) proves nothing, by design.

## 3–4. Source investigation (extends `PBP_PIPELINE_ARCHITECTURE.md` Phase 2)

No new information was obtainable this session beyond the prior research —
direct network access to every candidate (tennis-data.co.uk, api-tennis.com,
Sportradar, official ATP tour site) is blocked from this environment's tools
(sandbox egress proxy + WebFetch both refuse these domains; confirmed freshly
this session for `www.atptour.com` specifically, which was not tested
before). The status table from `PBP_PIPELINE_ARCHITECTURE.md` stands
unchanged: MatchStat/RapidAPI remains the most promising already-paid-for
lead (marketed as commercial-PBP-capable; only its `upcoming/matches`
endpoint is currently called in this codebase, so a historical/PBP endpoint
may already be available on the existing subscription — this requires
checking the actual RapidAPI dashboard, which I cannot do from here).

## 5–6. The 25+25 corroboration sample: **not executed, and here is exactly why**

Per the core rule of this whole exercise — never report something as
corroborated that wasn't — I am not fabricating a corroboration experiment.
Every candidate source is currently one of:

- **Down**: tennis-data.co.uk. A fresh GitHub Actions run was triggered this
  turn (real internet access, not this sandbox) specifically to re-check it;
  see the live run status note at the end of this document / this turn's
  chat reply for the actual outcome.
- **Blocked from this session's tools**: the official ATP tour site
  (`www.atptour.com`) — tested fresh this session via both direct `curl` and
  `WebFetch`, both refused by network policy. This is the source
  tennis-truth-engine's OWN production ingestion (`tour-results-schedule.server.ts`)
  successfully uses server-side, so it is very likely reachable from the
  real production environment — just not from my tools here.
- **Terms unconfirmed / not wired up**: api-tennis.com, MatchStat/RapidAPI,
  Sportradar — real leads, no code integration exists in this repo to call
  any of them for historical ATP 2012/2013 match lookups, and their exact
  commercial terms for this use were not verified against a real
  account/contract (see `PBP_PIPELINE_ARCHITECTURE.md` Phase 2).

**Building a corroboration experiment against a source with zero real
requests sent would just be theater** — either fabricated data (unacceptable)
or a script that immediately reports SOURCE_ERROR for all 50 samples (true,
but not informative beyond "this source is currently unreachable from
here," which this document already states directly). I built the reusable
interface and ran it in unit tests against fakes precisely so that the
moment ANY of the above sources becomes reachable (from this session, from
the real production environment, or once tennis-data.co.uk recovers), the
experiment can run for real with no further design work — but I will not
manufacture a fake pass through it now.

**If tennis-data.co.uk's fresh re-check (triggered this turn) came back up**:
that changes this section — see this turn's chat reply for the live result
and, if it recovered, the real (not synthetic) sample this document will
then contain in a follow-up commit.

## 7. PBP-specific corroboration: interface ready, no live test performed

`compare_point_sequences()` exists and is unit-tested against synthetic
alternate encodings (section 1). It has never been run against a second
real PBP-supplying provider's actual output, because no such provider is
integrated. This is stated plainly so it is never mistaken for evidence that
cross-provider PBP corroboration has happened.

## 8. Level definitions — exact current counts (never collapsed)

| State | 2012 | 2013 | Total |
|---|---:|---:|---:|
| CANDIDATE (raw, never reached structural check) | 0 | 0 | 0 |
| STRUCTURALLY_VALIDATED (current ceiling for all 4,065) | 1,919 | 2,146 | **4,065** |
| MATCH_CORROBORATED | 0 | 0 | **0** |
| PBP_CORROBORATED | 0 | 0 | **0** |
| LEVEL_1_VERIFIED | 0 | 0 | **0** |
| CONFLICT (structurally valid but disagrees with identity-resolved history) | 0 | 0 | 0 |
| REVIEW_REQUIRED (ambiguous identity) | 0 | 0 | 0 |

Every one of the 4,065 records carries `license_status = LICENSE_UNCERTAIN`
(ppaulojr) → `production_status = LICENSE_BLOCKED` regardless of validation
level, per `RecordStatus.production_status`.

**PRODUCTION_ELIGIBLE: 0.**

## 9. Remaining 1,228 — mutually exclusive breakdown (real data)

Combined 2012+2013, from the already-committed
`data/audit/pbp-identity-resolution-experiment/*.json` (`new_counts`,
re-verified this session):

| Category | Count |
|---|---:|
| No historical player pair (player identity unresolved) | 958 |
| Score and/or winner disagreement (`unresolved_other`) | 57 |
| Structural PBP parse failure | 213 |
| **Total remaining** | **1,228** |

958 breaks down further per `atp-pbp-player-identity-audit.py` (already
committed): 482 "players individually exist but this pair never met per
hist" (mostly doubles/Davis Cup rows and qualifying-round year-boundary
gaps — see `MATCH_IDENTITY_RESOLVER.md` section 3), 358 "one player entirely
absent from hist that year", 118 "both players entirely absent". Zero
ambiguous, zero duplicate, zero source-malformed in this breakdown — those
categories are empty because the identity resolver already routes anything
matching them into `REVIEW_REQUIRED`/`AMBIGUOUS` (currently 0, confirmed) or
`no_historical_player_pair`/`structural_failure` (already counted above), not
into a separate silent bucket.

No fuzzy matching was loosened to move any of these 1,228. All 1,228 remain
genuinely unresolved.
