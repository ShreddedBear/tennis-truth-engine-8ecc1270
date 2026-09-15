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

## 3. Root cause of the REVIEW_REQUIRED population (the single largest bucket)

Broke down all 1,865 by whether the historical match's own tournament name appears **anywhere** in the local Tennis-Data.co.uk sync file (`data/public/tennis-data-wta/wta_matches_2007_2016.csv`), across any of its 10 years:

- **1,214 (65.1%): tournament is completely absent from the local sync, every year.** This is not a small/obscure-event problem — the top entries are **Miami (246), Cincinnati (138), Indian Wells (61)**, three of the biggest WTA Premier Mandatory/Premier-5 events in the sport. Zero rows for any of Cincinnati, Indian Wells, Kuala Lumpur, Sydney, Paris, Acapulco, Marrakech, or Osaka appear anywhere in the 2007-2016 local file, while other tournaments (Guangzhou, Pattaya, Katowice) are present for most/all of the same years. This pattern (major, heavily-documented combined ATP/WTA events entirely missing, smaller standalone WTA events present) looks more like a **download/parse gap in `scripts/sync-tennis-data-wta.py`'s one-time sync** than a genuine absence in tennis-data.co.uk's own published archive, but this cannot be confirmed from this sandbox — `tennis-data.co.uk` is not reachable here (same egress block already documented for the earlier PBP fill), so verifying against the live source needs a CI environment with real internet access (the same environment that already successfully produced this file once).
- **651 (34.9%): tournament is present in the local sync, but this specific match still didn't get a unique corroborating hit.** Not further root-caused here (per "gap analysis only, no changes") — plausible causes include player-name-spelling variants, walkover/retirement score formatting differences, and date-boundary edge cases, but this needs case-by-case review, not a blanket fix.

## 4. Largest verification gaps, ranked

1. **Missing-tournament coverage in the existing LEVEL_1 source (2012-2015 non-Slam)** — up to 1,214 matches, if the sync gap in §3 is a fixable defect rather than a genuine source limit. Largest single opportunity by far, and requires **no new source** — just re-verifying/re-running the already-qualified Tennis-Data.co.uk sync.
2. **No independent corroboration attempted at all for the Slam lane (2016-2024)** — 2,991 matches structurally validated but single-source.
3. **Present-tournament, still-unmatched non-Slam rows** — 651 matches, smaller and needs manual pattern investigation rather than a new source.
4. **Ambiguous/conflict** — 67 combined, small.

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
| Fixed/re-verified Tennis-Data.co.uk sync | REVIEW_REQUIRED → LEVEL_1 | up to 1,214 (2012-2015 only) | Medium — depends entirely on whether the live source actually has this data; could be zero if the gap is a genuine source limitation, not a sync defect |
| WTA official API | LEVEL_2 → LEVEL_1 (Slam, 2016-2024) | up to 2,991 (all of it, if the API's historical depth and reliability hold up) | Low-medium — reachability, real historical depth, and license terms are all unconfirmed |
| Wikipedia / official Slam sites | LEVEL_2 → LEVEL_1 (Slam, 2016-2024) | up to 2,991 | Low — no existing integration, format/extraction risk is real |
| Manual review of present-tournament-but-unmatched rows | REVIEW_REQUIRED → LEVEL_1 | up to 651 (2012-2015) | Medium — this is a matching-precision fix against data already on hand, not a sourcing problem, but requires case-by-case investigation |

**No record was upgraded, and no new source was integrated, in this analysis.**

## 7. Recommended next concrete step (still analysis, not action, until you confirm)

The single highest-value, lowest-risk next step is **not** a new source integration at all: **determine whether `scripts/sync-tennis-data-wta.py`'s output genuinely reflects tennis-data.co.uk's live WTA archive**, since up to 1,214 records (65% of the entire REVIEW_REQUIRED population) trace to specific major tournaments (Miami, Cincinnati, Indian Wells, and others) being completely absent from that already-qualified, already-trusted local file. This requires a CI/production environment with real internet access (this sandbox cannot reach tennis-data.co.uk) — re-running the sync, or fetching a couple of the missing tournament-years directly, would confirm in minutes whether this is a fixable sync defect (large, free win, zero new licensing) or a genuine source limitation (in which case the WTA official API or Wikipedia become the live candidates worth pursuing for real).
