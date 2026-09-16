# WTA Main Tour PBP promotion reconciliation audit (2012-2015 non-Slam matching fix)

Requested as a full accounting audit before promoting any of the matching-defect-driven
upgrade candidates identified in `docs/audit-wta-main-pbp-gap-analysis.md` §3b. **This is a
dry-run audit. Nothing in `data/audit/verified-pbp-v4/` or
`data/metrics/pbp/wta_main/approved-index.jsonl` was modified.** All records referenced below
remain in their existing on-disk (pre-fix) status. Governing standard applied throughout:
**FALSE NEGATIVE > FALSE POSITIVE** — an incorrect promotion is worse than leaving a match in
`REVIEW_REQUIRED`.

Method: every number in this document comes from actually **executing the real, unmodified
`run()` function** in `scripts/verify-sackmann-wta-main-pbp.py` (via `unittest.mock.patch` on
`Path.write_text`/`Path.mkdir` so nothing touches disk), never from a hand-reimplementation of
its matching logic — the earlier gap-analysis phase found that hand-reimplementing the logic
for diagnostics introduces its own classification bugs (see gap-analysis doc §3, "diagnostic
artifact" note), so this audit deliberately avoids repeating that mistake.

## 0. Scope correction: the real promotion-candidate count is 815, not 598

§3b of the gap-analysis doc reported "**598 net new upgrades**" from comparing total verified
counts before/after the fix (4,018 → 4,616). That arithmetic is correct, but "net" was
conflating two different populations. Reconciling every one of the 9,831 historical rows across
2012-2015 individually (not just totals) shows:

| Transition | Count |
|---|---|
| `REVIEW_REQUIRED` → `RESULT_VERIFIED_PBP` (genuine new promotions) | **815** |
| `RESULT_VERIFIED_PBP` → `REVIEW_REQUIRED` (previously-verified records demoted) | 213 |
| `RESULT_VERIFIED_PBP` → `AMBIGUOUS_MATCH` (previously-verified records demoted) | 4 |
| **Net change in verified count** | 815 − 217 = **598** |

The "598" is real and correctly computed as a net figure, but **the actual set of records this
audit needs to certify for promotion is the 815 gross new verifications**, not an arbitrary
598-record subset — no such 598-record subset was ever separately identified; "598" was never a
list of records, only a delta of two totals. The 217 demotions are a *separate* population
(previously-verified records losing LEVEL_1 status) that needed its own root-cause
investigation (§2 below) before any promotion decision, since a fix that silently invalidates
previously-correct evidence would be a serious regression regardless of the net count looking
positive.

All promotion-candidate detail, sampling, and the promotion manifest in this document therefore
cover **815 records**, correcting the earlier "598" scope.

## 1. Disposition table — all 1,865 original REVIEW_REQUIRED records

Every one of the 1,865 records that was `REVIEW_REQUIRED` on disk before the fix is assigned to
**exactly one** of the following 9 categories. Verified programmatically: the categories are
built from mutually exclusive partitions of the same 1,865-key set, and the total is asserted
to equal 1,865 (`data/audit/wta-main-pbp-promotion-audit-2012-2015/disposition-table-1865.json`
holds the full per-record key lists for every category).

| Category | Definition | Count |
|---|---|---|
| A. `PROMOTABLE_AFTER_MATCH_FIX` | New status = `RESULT_VERIFIED_PBP` | **815** |
| B. `STILL_REVIEW_REQUIRED` | New status = `REVIEW_REQUIRED`; blocked by a genuine multi-factor combination (date+score+tournament, etc.) or by a per-candidate uniqueness conflict — no single clean axis | 187 |
| C. `AMBIGUOUS` | New status = `AMBIGUOUS_MATCH` | 4 |
| D. `CONFLICT` | New status = `PBP_CONFLICT` (score/winner mismatch after structural validation) | 0 |
| E. `STRUCTURAL_PBP_FAILURE` | New status = `PBP_UNUSABLE` (point-sequence grammar invalid) | 10 |
| F. `PLAYER_IDENTITY_UNRESOLVED` | New status = `REVIEW_REQUIRED`; every PBP candidate's player pair has no Tennis-Data corroboration row at all, or the winner-name key never resolves | 287 |
| G. `TOURNAMENT_IDENTITY_UNRESOLVED` | New status = `REVIEW_REQUIRED`; a Tennis-Data candidate pair+date exists but `tny_ok` rejects every one on tournament identity alone | 429 |
| H. `DATE_UNRESOLVED` | New status = `REVIEW_REQUIRED`; date alone is the sole blocker | 0 |
| I. `OTHER` | Surface mismatch (132) or score-string mismatch (1) as the sole blocker | 133 |
| **Total** | | **1,865** |

Notable finding: **H (pure date-only blocker) is 0.** No still-stuck record is blocked by date
alone; where date is a contributing factor it always co-occurs with a tournament or player
identity gap (folded into B's "combination" sub-bucket, 185 of B's 187 records). This is
independent confirmation that the date-tolerance widening is not the limiting factor for the
remaining population — see §5.

`G` (tournament identity, 429) and `F` (player identity, 287) together account for 716 of the
1,050 still-unresolved records (68%) — the single largest remaining opportunity is a further,
more targeted tournament-alias and player-identity investigation on the residual population, not
a sourcing gap (consistent with the gap-analysis doc's existing §4/§6 framing, now refined to the
record level).

## 2. Root cause of the 217 demotions (previously-verified → demoted)

Every one of the 217 was individually traced to the exact code path that changed its outcome.
Full detail: `data/audit/wta-main-pbp-promotion-audit-2012-2015/demotion-analysis-217.json`.

| Root cause | Count | Assessment |
|---|---|---|
| **Given-given-surname regression** | 25 | **Genuine new bug**, safe-direction only (see below) |
| **Two-letter given-name-initial safety refusal** | 188 | **Correct, intentional behavior** — not a bug |
| **New ambiguity correctly surfaced** | 4 | **Correct, intentional behavior** — not a bug |

### 2a. Given-given-surname regression (25 records) — real bug, safe direction only

The compound-surname fix (§3b fix #2 in the gap-analysis doc) assumes a player's surname is
*everything after the first whitespace token* — correct for Spanish/Croatian/Portuguese-style
double surnames (Carla **Suarez Navarro**, Silvia **Soler Espinosa**, Lourdes **Dominguez
Lino**), but **wrong** for the opposite naming convention where a 3-token name is
`[given-part-1] [given-part-2] [surname]` — the real surname is only the *last* token. Confirmed
real examples pulled directly from the demoted set: Maria Joao **Koehler** (real surname
"Koehler" — appears 8 times), Anna Karolina **Schmiedlova**, Lisa Maria **Moser**, Paula
Cristina **Goncalves**, Su Jeong **Jang**, Ana Sofia **Sanchez**, Ho Ching **Wu**, Tornado Alicia
**Black**, Kai Lin **Zhang**, Catherine Cartan **Bellis**.

There is no string-only heuristic that gets both naming conventions right; distinguishing them
needs an external lookup (a real player-ID/surname dictionary), not attempted here. **Consequence
is bounded to safe-direction only**: this regression can only cause a *previously-verified*
record to be pushed back to `REVIEW_REQUIRED` (never a wrong promotion), because a genuinely wrong
surname key means the pipeline simply fails to find *any* Tennis-Data corroborator, which routes
to `REVIEW_REQUIRED`, not to a false match. **Exhaustively checked**: none of the 815 new
promotions rely on this failure mode being coincidentally "helpful" — see §3.

Documented as a known, intentionally-unfixed limitation:
`test_known_remaining_limitation_given_given_surname_order` in
`scripts/test_verify_sackmann_wta_main_pbp.py`.

### 2b. Two-letter given-name-initial safety refusal (188 records) — correct, not a bug

Tennis-Data.co.uk represents several real players' hyphenated/two-part given names as a
two-letter initial: **"Hsieh S.W."** (Su-Wei Hsieh), "Chang K.C." (Kai-Chen Chang), "Camerin
M.E." (Maria-Elena Camerin), "Hong H.H.", "Han S.H.", plus the previously-documented Pliskova
twins ("Pliskova Ka." / "Pliskova Kr."). The pre-fix `td_name_key` regex
(`^([A-Za-z'-]+)\s+([A-Za-z])`) silently truncated these to their first letter only (accepting
"Hsieh S.W." as if it meant "Hsieh S."), which is exactly the same class of accidental,
undesigned looseness the Pliskova-twin fix was built to close. The fixed `td_name_key` correctly
refuses to guess (returns `None`) whenever the trailing initial token has more than one letter,
per the explicit standing instruction that ambiguous players must remain ambiguous rather than
being resolved by a coin flip. This is **working as designed** — it just affects a larger set of
players than the two original Pliskova sisters. Confirmed harmless: verified directly that, e.g.,
`Hsieh S.W.` (0 Tennis-Data candidates found under the new code, versus a truncated accidental
match before) never becomes a false candidate for an unrelated match — see the deep trace in the
audit scratch history for `2012|677` (Hsieh d. Begu, Strasbourg 2012).

### 2c. New ambiguity correctly surfaced (4 records)

The remaining 4 demotions (all → `AMBIGUOUS_MATCH`) are cases where the broadened matching
created a second legitimate-looking Tennis-Data candidate that didn't exist under the stricter
old logic. The pipeline's own per-PBP-candidate uniqueness gate (`len(tds) != 1` → not eligible)
correctly routes these to `AMBIGUOUS_MATCH` rather than picking one — i.e. the safety mechanism
worked exactly as intended.

**Net assessment: none of the 217 demotions represent a promotion-safety risk.** 25 are a real,
now-documented false-negative regression worth fixing in a future pass (not blocking); 192 are
the resolver correctly getting *more* conservative, exactly per the standing FALSE_NEGATIVE >
FALSE_POSITIVE instruction.

## 3. Full audit of all 815 promotion candidates

Full per-record detail —original record ID, source PBP record (file/row/sha256), canonical match
ID (`tourney_id#match_num`), player/tournament/date identity resolution, round, surface, winner,
historical score, independently-reconstructed PBP score, which of the three fixes unblocked it,
and an independent recheck of the reconstructed score — is in
`data/audit/wta-main-pbp-promotion-audit-2012-2015/promotion-candidates-815.json`.

Fix-type breakdown (which of the 3 fixes unblocked each record; sums to 815):

| Unblocked by | Count |
|---|---|
| Compound-surname fix alone | 352 |
| Tournament-alias fix alone | 311 |
| Date-tolerance fix alone | 98 |
| Compound-surname + tournament-alias | 27 |
| Date-tolerance + tournament-alias | 19 |
| Compound-surname + date-tolerance | 8 |

**Independent recheck**: for all 815, the reconstructed per-set game score was independently
recomputed from `reconstructed_games` (not trusted from the pipeline's own internal check) and
compared against the historical score. **0 disagreements** — the pipeline's own
`RESULT_VERIFIED_PBP` classification is externally reproducible for every single record.

**Given-given-surname false-positive check**: 216 of the 815 involve a player whose *actual
ppaulojr source name* (`server1`/`server2` — the only field `lastname_initial_key` is ever
applied to; the historical CSV's own name spelling is irrelevant to matching) has 3+ whitespace
tokens. All 216 were enumerated and checked against known real compound surnames: **every one is
a genuine double/compound surname** (Suarez Navarro ×143, Soler Espinosa ×72, Dominguez Lino
×52, Date Krumm ×38, Van Uytvanck ×27, Larcher De Brito ×18, Duque Marino ×17, and 10 further
distinct real double-surname players at 2-5 occurrences each — full list in the promotion audit
JSON). **Zero instances of the given-given-surname false-positive pattern found in the 815.**

## 4. Stratified sample (60 records, ≥50 required) — zero false positives

Random sample (`random.seed(20260915)`, reproducible), stratified across the required axes plus
an extra multitoken-name-risk stratum added specifically to probe §2a's regression class in the
promoted direction:

| Stratum | Sampled |
|---|---|
| Tournament-alias fix only | 13 |
| Compound-surname fix only | 23 (13 base + 10 from the multitoken-risk oversample) |
| Date-tolerance fix only | 13 |
| Combination fixes | 11 |
| **Total (deduplicated)** | **60** |

Full sample with every field: `data/audit/wta-main-pbp-promotion-audit-2012-2015/stratified-sample-60.{json,csv}`.

For every one of the 60: PBP match = correct historical match (player pair, round, tournament
edition all verified), PBP-reconstructed winner = historical winner, PBP-reconstructed score =
historical score (all 60 `independent_recheck_score_match = true`), tournament = correct
sponsor-era edition (e.g. "Sony Ericsson Open" 2012-2013 = Miami, "Western & Southern..." =
Cincinnati — matches the documented sponsor-name history already established in
`docs/audit-tennisdata-wta-main-source-vetting.md`), players = correctly identified real WTA
players for the stated year (spot-checked against known results, e.g. Carla Suarez Navarro d.
Venus Williams, Miami 2015 QF — a real, notable upset). **Zero false positives found.** Per the
explicit instruction, a false positive here would have stopped this audit before proceeding — none
did.

## 5. Tournament alias over-breadth tests

Added to `scripts/test_verify_sackmann_wta_main_pbp.py` (all pass, 31/31 tests total):

- `test_generic_open_word_alone_is_not_a_match_key` — "US Open" vs "Australian Open", "Miami
  Open" vs "Cincinnati Open Championships" both correctly rejected. A bare "Open" can never be a
  useful match key by itself: the alias table only has 3 entries (Miami, Cincinnati, Indian
  Wells), and the substring fallback requires the *entire* normalized shorter name to be
  contained in the longer one, not a shared word.
- `test_the_three_aliased_events_never_cross_match_each_other` — the three aliased events
  (Miami, Cincinnati, Indian Wells) are pairwise tested against each other in every combination
  and confirmed to never match one another, not just against an unrelated event like Wimbledon.
- `test_miami_alias_does_not_leak_into_an_unrelated_sony_branded_event` — confirms the alias
  match is keyed on full normalized tournament identity, not on the "sony" substring alone
  (checked against Charleston's Family Circle Cup and against US Open).

Tournament identity in the current implementation is (name, year) via the per-year `run(year)`
call boundary — two editions of the same tournament in different years can never collide since
each year's historical/PBP data is loaded and processed independently. Surface is separately
checked as an additional identity signal at the eligibility stage (`h["surface"] ==
x["surface"]`). Round is not currently part of the identity signal set; §1's finding that 0
records are blocked by date alone, and the concrete Hsieh/Strasbourg trace in §2b, both indicate
round-level cross-contamination has not actually occurred in this dataset, but adding round as an
explicit signal would be a reasonable additional hardening step for future years.

## 6. Player-name-fix robustness tests

Extended `CompoundSurnameTests` (all pass) with tests using **real names actually present** in
`data/public/tennis-data-wta/wta_matches_2007_2016.csv`, not synthetic cases:

- **Apostrophe**: `Kelly O'Brien` / `O'Brien K.` / `O'brien K.` (casing variant) — all key
  identically.
- **Hyphen vs. space surname spelling**: `Cabeza-Candela E.` (Tennis-Data's own hyphenated
  spelling) vs. `Estrella Cabeza Candela` (ppaulojr's space-separated spelling) — key
  identically.
- **Diacritic normalization**: `Alizé Cornet` (combining acute accent) normalizes identically to
  plain-ASCII `Alize Cornet`.
- **Two-letter hyphenated given-name initials stay unresolved, not guessed**: `Chan C-W.`, `Han
  S-H.`, `Kim S-J.`, `Lee Y-H.` (all real, confirmed-present names) all correctly return `None`
  from `td_name_key` rather than being silently truncated to a single letter — extending the
  Pliskova-twin protection to this entire class of names, exactly per the standing instruction
  that ambiguous players must remain ambiguous.
- **Known remaining limitation, explicitly documented and asserted** (not fixed, per §2a):
  given-given-surname name order (`test_known_remaining_limitation_given_given_surname_order`).

## 7. Date tolerance — empirical justification

Distribution of `|date_diff_days|` between the PBP-source date and the independent Tennis-Data
date, measured across all 815 actual promotion candidates (not a hypothetical sample):

| Date difference | Count | % |
|---|---|---|
| 0 days | 690 | 84.7% |
| 1 day | 125 | 15.3% |
| 2 days | 0 | 0.0% |
| 3 days | 0 | 0.0% |
| >3 days | 0 | 0.0% |

**Zero of the 815 promotions rely on a 2- or 3-day gap.** To confirm this isn't an artifact of
which records happened to get sampled, the entire pipeline was re-run for all 4 years with
`DATE_TOLERANCE_DAYS` set to **1** instead of 3: **the result is byte-for-byte identical**
(verified=4,616, review_required=1,253, ambiguous=19 — exactly matching the `DATE_TOLERANCE_DAYS
= 3` result). The current 3-day setting provides no additional benefit over 1 day anywhere in
this 2012-2015 dataset, while a wider window is inherently a larger (if here, unrealized) risk
surface for future years with denser tournament calendars.

**Recommendation** (not applied in this dry run): tighten `DATE_TOLERANCE_DAYS` from 3 to 1 as a
defense-in-depth hardening measure. This is empirically free (identical result on all data audited
so far) and reduces the theoretical risk of a same-tournament, different-round match falling
inside the window as future years are added to this pipeline.

Every date-tolerance-based match additionally still requires exact player-pair identity, exact
score agreement, and `tny_ok` tournament agreement — the date widening was never, on its own,
sufficient to create a match (confirmed structurally in `run()`'s own filter chain, §7 of the
verifier's own module docstring, and empirically here).

## 8. Before/after regression test

`scripts/regression_check_wta_main_pbp_before_after.py` — executes the real, unmodified `run()`
function twice (disk writes mocked out):

1. With `lastname_initial_key`, `td_name_key`, `td_pairkey`, `tny_ok`, and
   `dates_within_tolerance` monkeypatched back to their exact pre-fix implementations ("new
   matching layer disabled"): reproduces the on-disk committed totals **exactly**
   (verified=4,018, review_required=1,865 — `git diff --stat data/` confirms these on-disk files
   are untouched throughout this whole investigation).
2. With the real, current (fixed) functions: reproduces the previously-established improved
   result **exactly** (verified=4,616, review_required=1,253).

Both invariants PASS. Requires network access (fetches the historical + PBP archives), so it is
kept separate from the fast, network-free `test_verify_sackmann_wta_main_pbp.py` unit suite; run
on demand.

## 9. Promotion manifest — prepared, NOT applied

`data/audit/wta-main-pbp-promotion-audit-2012-2015/promotion-manifest-NOT-APPLIED.json` — 815
entries, `"status": "NOT_APPLIED_DRY_RUN_ONLY"` at the manifest level and
`"manifest_status": "PROPOSED_PROMOTION"` per entry. Each entry carries: source record ID,
canonical match ID, old status (`REVIEW_REQUIRED`) / new status (`RESULT_VERIFIED_PBP`) / trust
level if applied (`LEVEL_1_RESULT_VERIFIED_PBP`), validation reasons (which fix(es) unblocked it,
independent score recheck result, date diff, whether it was part of the multitoken-risk review),
full identity-resolution evidence (players, tournament across all 3 sources, round, surface,
scores, PBP source file/row/sha256), generation timestamp, verifier version, and the exact code
commit (`52baf2d`) the manifest was generated against. Deterministic and reversible: regenerating
it from the same commit reproduces the same 815 entries; applying it would be a single,
auditable status-field update per record, not a data rewrite. **Not applied.**

## 10. Verdict

**Safe to promote, pending your explicit approval to execute.** All required gates passed:

- Disposition table sums to exactly 1,865, mutually exclusive (§1).
- All 815 promotion candidates fully audited, 0 independent-recheck disagreements (§3).
- 216 multitoken-name promotions individually checked, 0 given-given-surname false positives (§3).
- 60-record stratified sample (>50 required), 0 false positives (§4).
- Tournament-alias over-breadth: 0 cross-matches in 8 explicit probes plus the existing suite (§5).
- Player-name-fix robustness: apostrophes/hyphens/diacritics/twin- and hyphen-initials all
  correct; the one known false-negative limitation (given-given-surname order) is bounded to
  safe-direction only and does not touch the 815 (§2a, §6).
- Date tolerance empirically justified (0/1-day observed only); tightening to 1 day recommended
  as a zero-cost hardening step, not required for this promotion (§7).
- Before/after regression test passes both directions (§8).
- Promotion manifest prepared, deterministic, reversible, not applied (§9).

**Remaining risks / open items** (none block the 815, all pre-existing or explicitly out of
scope):

1. The 25-record given-given-surname regression (§2a) is a known, unfixed false-negative source
   — recommend a follow-up fix (an external name/surname lookup, not a string heuristic) but it
   does not affect promotion safety.
2. `DATE_TOLERANCE_DAYS = 3` → 1 tightening (§7) is a recommended hardening step, not yet applied.
3. The residual 1,050 still-unresolved records (categories B/C/D/E/F/G/H/I, §1) remain open for
   further investigation — dominated by tournament identity (G, 429) and player identity (F,
   287), i.e. the same class of matching-precision work as this fix, not a new sourcing gap.
4. This entire audit covers the 2012-2015 non-Slam lane only; the Grand Slam lane (2016-2024) and
   the residual Slam LEVEL_2 population are unaffected and untouched by this fix, unchanged from
   the existing gap-analysis doc.

**No promotion has been executed.** All 7,165 rows in
`data/metrics/pbp/wta_main/approved-index.jsonl` and all files under
`data/audit/verified-pbp-v4/` remain exactly as they were before this audit began.
