# ATP main-tour PBP source license audit (2026-09-15)

Scope: every source currently used or evaluated for ATP main-tour point-by-point
ingestion. Verdicts follow the rule already stated in `THIRD_PARTY_DATA.md`:
*"Do not add a dataset to the production evidence store unless its commercial
reuse terms have been verified."*

## Aneeshers/tennis-sackmann-archive (match-identity source, NOT PBP)

- Used by: `scripts/verify-sackmann-pbp-v4.py` (`HIST_BASE`) for ATP/WTA main +
  challenger match identity (tournament, date, round, surface, winner, score).
- License, per its own README/LICENSE (fetched and read in full): **CC BY-NC-SA
  4.0**, explicitly redistributing Jeff Sackmann's own license terms verbatim.
  README: *"Per the license, use is non-commercial, and any redistribution must
  carry the same license."*
- **Already documented in this repo**: `docs/ATP_DATA_ATTRIBUTION.md` states
  *"This integration is intended only for the app's current non-commercial/free
  use. Do not use this dataset in a commercial or monetized version..."* — this
  is a known, accepted constraint for tennis-truth-engine, not a new finding.
- Its README additionally reveals the archive also mirrors
  `JeffSackmann/tennis_slam_pointbypoint` (real Grand Slam PBP, 2011-2024,
  `slam_pointbypoint/` folder) under the *same* license. Not currently fetched
  by any script. Real, usable PBP data for Slams specifically, but bound by the
  same non-commercial restriction as everything else from this archive.
- **Verdict: NONCOMMERCIAL_ONLY.** Consistent with existing project policy.

### Cross-repo gap found during this audit (not previously documented)

`tennis-stats-engine`'s `sackmannBackfill.ts` ingests the *same underlying*
Jeff Sackmann `tennis_atp`/`tennis_wta` data (CC BY-NC-SA 4.0 by its own
license, regardless of which mirror serves it) directly into
`historical_matches` (`provider='sackmann'`, confirmed ~34,229 rows per prior
session's audit) with **no license documentation anywhere in that repo** — no
`THIRD_PARTY_DATA.md`, no attribution doc, no comment in `sackmannBackfill.ts`
mentioning licensing at all. Unlike tennis-truth-engine, tennis-stats-engine
has payments infrastructure (`paymentsAccountTable`, `paymentWebhookEventsTable`)
suggesting a monetized product. **This needs a human decision before any new
Sackmann-lineage data (PBP included) is persisted into `pbp_evidence`** — it is
a pre-existing condition of that table (not introduced by this audit), but this
audit is the first record of it being examined.

## ppaulojr/tennis_pointbypoint (the only integrated raw PBP source)

- No `LICENSE`/`LICENSE.md`/`LICENSE.txt` file exists in the repo (all checked,
  all 404). No license statement anywhere in `README.md` (fetched and read in
  full — quoted below).
- README describes the data as compiled/parsed/cleaned by ppaulojr from
  unspecified "original source data" — the repo does not state where that
  underlying data originally came from, so there is no clear rights chain
  either from ppaulojr or from a named upstream rightsholder.
- Under default copyright law and GitHub's own terms, a public repository with
  no license grants only the ability to view/fork on GitHub itself — it does
  **not** grant a license to reuse, copy, or redistribute the content elsewhere
  by default.
- **Distinguishing internal statistical use from redistribution** (as asked):
  - Computing *derived* statistics from a tape transiently (e.g. hold%, break%,
    comeback-pressure inputs for metrics 002/003/009/...) without storing or
    exposing the raw tape itself is a materially different, lower-risk use.
    Facts/statistics derived from data are generally not themselves
    copyrightable (*Feist v. Rural*), though the specific compiled dataset may
    still carry its own protection as a compilation.
  - Storing the verbatim raw point-sequence string in a durable table
    (`pbp_evidence.pbpRaw`, as currently schema'd) is much closer to
    reproduction/redistribution of the dataset itself, not mere statistical
    use — this is the design decision that actually needs resolving.
- I am not qualified to give a legal clearance, and none exists today.
- **Verdict: LICENSE_UNCERTAIN** (per the requested taxonomy) — not "NO", not
  "YES", genuinely undetermined. Recommendation: safe to continue using
  transiently for structural/identity verification (no new copy created beyond
  what the existing pipeline already does in-memory); **do not populate
  `pbp_evidence.pbpRaw` with ppaulojr tapes until this is resolved.**

## tennis-data.co.uk (independent corroborator only, currently down)

- Site's own terms were not re-checked in this audit (currently unreachable —
  see the outage record in `data/audit/verified-pbp-v4/atp_main/*/summary.json`
  and the retry/backoff/HTTP-fallback fix already shipped). tennis-data.co.uk
  has historically stated its data is free for personal/non-commercial use;
  this needs re-confirming once the site is reachable again.
- Used only as a transient cross-check (compare date/winner/score/surface/round
  against an independently-sourced value) — no data from this source is stored
  verbatim anywhere in the pipeline today. Lower risk than a stored dataset,
  but still unverified.
- **Verdict: LICENSE_UNCERTAIN** (unconfirmed, not unresolved-and-ignored).

## JeffSackmann/tennis_MatchChartingProject

- Already catalogued in `src/lib/yellow-metric-sources.ts` as
  `access: "NONCOMMERCIAL_ONLY"` — existing, correct policy, not new.
- Real PBP-adjacent data (shot type/direction, serve/return depth) but only for
  charted matches — a curated subset, mostly Slams and top players. Would never
  cover the full ATP main tour even if licensing permitted it.
- **Verdict: NONCOMMERCIAL_ONLY** — excluded from the commercial production
  path, consistent with existing policy. No change made.

## Sources considered and ruled out for ATP-main-tour PBP specifically

- **BSD/Bzzoiro** (`sports.bzzoiro.com`): live paid API, tier-3 runtime
  fallback. Already decided (this session, prior turn): kept live-only, not
  promoted to approved historical/durable evidence.
- **TennisMyLife**: ATP Challenger box scores only (aces, DFs, serve points) —
  not PBP, not ATP main tour. Out of scope by tour and by data type both.
- **PredixSport**: ELO ratings only (CC BY 4.0, already documented in
  `THIRD_PARTY_DATA.md`) — not match identity, not PBP. Irrelevant here.
