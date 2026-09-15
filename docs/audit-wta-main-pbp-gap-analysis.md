# WTA Main Tour PBP gap analysis (2012 → current)

Analysis only — **zero records modified**. `git diff --stat` confirms no changes under `data/`.

## 1. Coverage matrix, 2012 → current

| Year | Lane | LEVEL_1 | LEVEL_2 | Notes |
|---|---|---|---|---|
| 2012 | non-Slam (incl. Slam matches) | 1,124 | 0 | includes 259 Grand Slam matches at LEVEL_1 |
| 2013 | non-Slam (incl. Slam matches) | 1,261 | 0 | includes 277 Grand Slam matches at LEVEL_1 |
| 2014 | non-Slam (incl. Slam matches) | 1,258 | 0 | includes 284 Grand Slam matches at LEVEL_1 |
| 2015 | non-Slam (incl. Slam matches) | 375 | 0 | includes 95 Grand Slam matches at LEVEL_1 |
| 2016 | Slam only | 0 | 243 | AusOpen/RG/USOpen only (no Wimbledon women's data upstream) |
| 2017 | Slam only | 0 | 369 | all 4 Slams |
| 2018 | Slam only | 0 | 419 | all 4 Slams |
| 2019 | Slam only | 0 | 452 | all 4 Slams |
| 2020 | Slam only | 0 | 334 | AusOpen/RG/USOpen (Wimbledon not played) |
| 2021 | Slam only | 0 | 462 | all 4 Slams |
| 2022 | Slam only | 0 | 236 | USOpen/Wimbledon only (archive has no 2022+ AusOpen/RG files) |
| 2023 | Slam only | 0 | 240 | USOpen/Wimbledon only |
| 2024 | Slam only | 0 | 236 | USOpen/Wimbledon only |
| **Total 2012→current** | | **4,018** | **2,991** | **7,009** |
| 2011 (out-of-target) | | 156 | 0 | historical, not counted above |

By surface (2012→current): Hard 4,151 · Clay 1,545 · Grass 1,313.
By tier (2012→current): Grand Slam 3,906 (915 at LEVEL_1 via 2012-2015 non-Slam pipeline + 2,991 at LEVEL_2 via 2016-2024 Slam archive) · International 1,399 · Premier 1,151 · Premier Mandatory 553.

## 2. Unresolved populations, 2012→current only (2011's 239 review/127 ambiguous/275 conflict excluded — out of target)

| Status | Count | Meaning |
|---|---|---|
| REVIEW_REQUIRED | 1,865 | PBP candidate matched a canonical historical match by player+score+tournament, but the independent local Tennis-Data.co.uk sync did not return exactly one corroborating result |
| AMBIGUOUS_MATCH | 11 | multiple PBP or hist candidates, could not disambiguate |
| PBP_CONFLICT / PBP_UNUSABLE | 56 | structural replay or score mismatch — genuinely rejected, not a sourcing gap |

(2016-2024 Slam lane has its own separate, already-reported rejection counts — 366 `NO_HIST_MATCH` + 90 `PBP_UNUSABLE` — those are identity/structural rejections, not corroboration gaps, since the Slam lane doesn't attempt third-party corroboration at all.)

## 3. Root cause of the REVIEW_REQUIRED population — UPDATED, superseding the original §3 below

**The original substring-based "present in TD / absent from TD" classification below was a false proxy.** A follow-up investigation traced the actual matching code (`scripts/verify-sackmann-wta-main-pbp.py`) end to end and reconciled every one of the 1,865 REVIEW_REQUIRED rows against the exact candidate-matching logic (not a crude tournament-name substring search). Verdict: **this is a MATCHING DEFECT, not a sync defect and not (for the tournaments checked) a genuine source gap.** The Tennis-Data.co.uk sync itself is intact: `scripts/sync-tennis-data-wta.py` has no per-tournament filter of any kind, `r.raise_for_status()` means a failed year-download would have crashed the whole sync rather than silently producing a partial file, and `DEDUP_REPORT.json` shows a plausible ~2,400-2,520 rows for every one of its 10 years with zero dedup collisions. Miami, Cincinnati, and Indian Wells **are present** in the local file — the earlier substring check missed them because Tennis-Data.co.uk stores them under era-specific title-sponsor names ("Sony Ericsson Open", "Western & Southern Financial Group Women's Open", "BNP Paribas Open") that share no substring with "Miami"/"Cincinnati"/"Indian Wells".

Reconciling all 1,865 rows against the real matching code found three distinct, confirmed defects (exact counts, not estimates — reproduced via `scripts/verify-sackmann-wta-main-pbp.py`'s actual functions):

| Reason | Count | % | Confirmed cause |
|---|---|---|---|
| `TOURNAMENT_NAME_MISMATCH` | 980 | 52.5% | `tny_ok()`'s plain substring check can't bridge a title-sponsor-name change between the two sources (e.g. ppaulojr's `SonyOpenTennis-WTAMiami` vs Tennis-Data's `Sony Ericsson Open`) — confirmed for Miami, Cincinnati (also compounded by an undecoded `&amp;` HTML entity) |
| `PLAYER_NAME_NO_TD_PAIR_MATCH` | 630 | 33.8% | includes a confirmed compound-surname parsing bug: `lastname_initial_key`/`td_name_key` took only the *last* whitespace token as "the surname", breaking every double-surname player (e.g. Carla Suarez Navarro -> wrongly keyed `('navarro','c')` instead of `('suareznavarro','c')`); not yet separated from genuine no-pair cases within this bucket |
| `DATE_MISMATCH` | 133 | 7.1% | ppaulojr's and Tennis-Data's per-match `date` field can legitimately differ by a few days for the same real match inside one tournament (confirmed: a Miami 2013 match dated 2013-03-18 by ppaulojr, 2013-03-20 by Tennis-Data) — exact date equality was too strict |
| (diagnostic artifact, not a real defect) | 119 | 6.4% | rows my reconciliation harness flagged as "should have matched" because it didn't replicate the real pipeline's surface-equality and duplicate-protection checks — resolved automatically once the fixes were exercised through the real `run()` function itself (§3b), not a separate defect |
| `SCORE_MISMATCH` | 3 | 0.2% | genuine score conflicts between sources — correctly rejected, not a defect |

Per-tournament, this also explains why Miami/Cincinnati and Indian Wells failed for *different* reasons: Miami (205/246) and Cincinnati (120/138) are dominated by `TOURNAMENT_NAME_MISMATCH` (title-sponsor churn); Indian Wells (61/61) has *zero* tournament-name failures and is instead `DATE_MISMATCH` (34) and `PLAYER_NAME_NO_TD_PAIR_MATCH` (27) — its Tennis-Data alias ("BNP Paribas Open") is present too, confirmed separately.

The original substring-based estimate below undercounted the true fixable population (1,214 "absent" was itself partly wrong, since it misclassified present-but-differently-named tournaments as absent) and is superseded by the reconciliation above and the measured fix in §3b.

<details>
<summary>Original §3 (superseded, kept for the record)</summary>

Broke down all 1,865 by whether the historical match's own tournament name appears **anywhere** in the local Tennis-Data.co.uk sync file (`data/public/tennis-data-wta/wta_matches_2007_2016.csv`), across any of its 10 years:

- **1,214 (65.1%): tournament is completely absent from the local sync, every year.** This is not a small/obscure-event problem — the top entries are **Miami (246), Cincinnati (138), Indian Wells (61)**, three of the biggest WTA Premier Mandatory/Premier-5 events in the sport. [Superseded: these tournaments are in fact present, under era-specific sponsor names the substring check didn't recognize — see above.]
- **651 (34.9%): tournament is present in the local sync, but this specific match still didn't get a unique corroborating hit.**

</details>

## 3b. Fix implemented and measured (matching code only — no PBP records changed)

Three fixes applied to `scripts/verify-sackmann-wta-main-pbp.py`, each targeting one confirmed defect above:

1. **Tournament alias table** (`TOURNAMENT_ALIASES`) mapping known title-sponsor-name variants (Miami, Cincinnati, Indian Wells) to a stable event key, checked as a fallback when the plain substring check fails. `norm_tny()` also now HTML-unescapes input first (fixes the `&amp;` case).
2. **Compound-surname fix**: `lastname_initial_key` and `td_name_key` both now take the surname as *everything after the first token* (matching the same convention already used correctly by the sibling Grand Slam script), instead of only the last token.
3. **Date tolerance**: the Tennis-Data pair+date lookup now accepts dates up to 3 days apart (`dates_within_tolerance`, `DATE_TOLERANCE_DAYS = 3`) instead of requiring exact equality — safe because every other check (player-pair identity, winner name, score, tournament) is still required to match exactly; only the date comparison was widened.

**Measured via a dry run of the real, unmodified `run()` function** (file writes intercepted with `unittest.mock.patch` so nothing touched disk — confirmed after the fact with `git diff --stat` showing zero changes under `data/`):

| Year | Old verified | New verified (dry run) | Old review_required | New review_required |
|---|---|---|---|---|
| 2012 | 1,124 | 1,238 | 404 | 286 |
| 2013 | 1,261 | 1,475 | 560 | 337 |
| 2014 | 1,258 | 1,438 | 610 | 428 |
| 2015 | 375 | 465 | 291 | 202 |
| **Total** | **4,018** | **4,616** | **1,865** | **1,253** |

**Net new upgrades: 598** (2012-2015 non-Slam, would move REVIEW_REQUIRED -> RESULT_VERIFIED_PBP if this fix is applied and the pipeline re-run). The remaining reduction in REVIEW_REQUIRED (612 total, minus 598 verified = 14) moved to `AMBIGUOUS_MATCH` (+8) and `PBP_CONFLICT`/`PBP_UNUSABLE` (+6) instead — i.e. the newly-found candidates that turned out to be genuinely ambiguous or conflicting were correctly routed there, not force-verified. **No record has actually been promoted yet** — this is a measured, reproducible dry-run result, pending explicit approval to execute for real.

## 4. Largest verification gaps, ranked (updated per §3b)

1. **Matching-code defects against the existing, already-qualified LEVEL_1 source (2012-2015 non-Slam)** — **598 matches confirmed fixable** by a dry run of the real pipeline (§3b); zero new source needed. This is a matching-precision fix, not a sourcing gap.
2. **No independent corroboration attempted at all for the Slam lane (2016-2024)** — 2,991 matches structurally validated but single-source; unaffected by the §3b fix (different pipeline, no Tennis-Data cross-check attempted there at all).
3. **Remaining REVIEW_REQUIRED after the §3b fix** — 1,253 matches (was 1,865); genuinely needs either further matching-precision work or an additional independent source, not yet root-caused further.
4. **Ambiguous/conflict** — 75 combined after the fix (was 67; +8 ambiguous, +6 conflict — see §3b), small.

## 5. Candidate independent sources for each gap

### For gap #1 (missing-tournament sync coverage)

| Source | Provenance | License/access | Years | WTA Main coverage | Match-result coverage | PBP coverage | Independence | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Re-run/audit `scripts/sync-tennis-data-wta.py` itself against live tennis-data.co.uk** | Already the project's own qualified LEVEL_1 source | Already documented (`data/public/tennis-data-wta/SOURCE.md`) — "free to use" | 2007-2016 (already the target range) | Full WTA tour, if the sync actually pulls everything the live site has | Set-score results only (already sufficient — this is the corroboration step, not the PBP tape) | N/A (not a PBP source, a corroboration source) | Already established as independent of Sackmann/ppaulojr | **Usable in principle — needs a live-network CI run to confirm whether Miami/Cincinnati/etc. exist in the real live file; not testable from this sandbox** |

This is not "a new source" — it's re-verifying the one already in use. No new licensing/provenance work needed if confirmed.

### For gap #2 (Slam lane independent corroboration, 2016-2024)

| Source | Provenance | License/access | Years | WTA Main coverage | Match-result coverage | PBP coverage | Independence from existing pipeline | Verdict |
|---|---|---|---|---|---|---|---|---|
| **WTA official API** (`api.wtatennis.com/tennis/players/{id}/matches?year=`) | The tour's own governing-body system | Unknown — no license terms found anywhere in this repo for this endpoint; it is already called live elsewhere in this codebase (`src/lib/wta-official-match-evidence.server.ts`) for other metrics, without a documented license either | Endpoint is year-parameterized with no apparent floor beyond `year>=1960` in this project's own code, but actual historical data depth for 2016-2024 is unconfirmed | Full tour, by definition (it's the tour's own system) | Date, tournament, round, opponent, score, rank — everything needed to independently corroborate identity + score | No | Highest possible authority (the tour itself) if it works | **Strong candidate, not yet usable**: blocked from this sandbox (`api.wtatennis.com` unreachable, same egress policy as tennis-data.co.uk); needs a CI environment to confirm live reachability, real historical depth, and rate limits before any integration; license terms for bulk historical corroboration use are undocumented and should be confirmed before relying on it |
| **`tennisdata-wta-main` (TennisData.app)** | — | — | — | — | — | — | — | **Excluded per your instruction — already formally rejected for provenance/reliability reasons; not revisited here** |
| Official Grand Slam sites (ausopen.com, rolandgarros.com, wimbledon.com, usopen.org) | Tournament-official | Undocumented, likely restrictive copyright on presentation (facts/scores themselves are generally not copyrightable, but this needs real legal review, not an assumption) | Per-tournament, would need per-site scraping | Grand Slam only (fits this exact gap) | Full draws/scores | No | Yes, fully independent of Sackmann | **Not usable yet** — no existing code path, no license review, would be new integration work (out of scope for this analysis phase) |
| Wikipedia tournament/draw pages | Crowd-sourced from official sources | CC BY-SA (attribution + share-alike, less restrictive than the CC BY-NC-SA already accepted for Sackmann data) | Full historical range | Grand Slam and most tour events | Full draws/scores, structured but inconsistently formatted across pages/years | No | Yes | **Plausible, not yet usable** — needs live web access (blocked here), and a real extraction/parsing plan (infobox/table formats vary by page and by year) — new integration work |

## 6. Estimated upgrade counts if each source is confirmed usable

| Source | Gap addressed | Estimated matches that could move | Confidence |
|---|---|---|---|
| Matching-code fixes (§3b), applied for real | REVIEW_REQUIRED → LEVEL_1 | **598, measured exactly via dry run** | High — this is not an estimate, it's a reproducible dry-run count from the real pipeline code; only remaining step is executing it for real |
| WTA official API | LEVEL_2 → LEVEL_1 (Slam, 2016-2024) | up to 2,991 (all of it, if the API's historical depth and reliability hold up) | Low-medium — reachability, real historical depth, and license terms are all unconfirmed |
| Wikipedia / official Slam sites | LEVEL_2 → LEVEL_1 (Slam, 2016-2024) | up to 2,991 | Low — no existing integration, format/extraction risk is real |
| Further matching-precision work on the remaining 1,253 REVIEW_REQUIRED | REVIEW_REQUIRED → LEVEL_1 | unknown, not yet root-caused past §3b's fix | Medium — same class of investigation as §3b, not yet done for the residual population |

**No record was upgraded, and no new source was integrated, in this analysis or the follow-up matching-defect investigation. The 598-match fix is measured and ready, pending your approval to execute.**

## 7. Recommended next concrete step — updated per §3b

The matching-defect investigation is complete and the fix is measured (598 matches, §3b), pending approval to execute it for real (re-run `scripts/verify-sackmann-wta-main-pbp.py` for 2012-2015 and `scripts/build-wta-main-pbp-approved-index.py`, writing to `data/audit/verified-pbp-v4/wta_main/` and `data/metrics/pbp/wta_main/approved-index.jsonl` for the first time this session).

After that: the residual 1,253 REVIEW_REQUIRED rows and the Slam lane's 2,991 LEVEL_2 rows (no independent corroboration attempted at all) remain open. For the Slam lane specifically, the WTA official API (already called elsewhere in this codebase) remains the strongest candidate, still blocked by this sandbox's network restrictions and undocumented license terms — unchanged from the original recommendation.
