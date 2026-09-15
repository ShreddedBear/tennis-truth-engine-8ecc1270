# WTA Main historical point-by-point data attribution

WTA Main historical point-by-point (PBP) ingestion (scripts/verify-sackmann-wta-main-pbp.py,
scripts/verify-sackmann-wta-main-slam-pbp.py) uses two sources, both accessed through the
`Aneeshers/tennis-sackmann-archive` GitHub mirror or a directly-named upstream repository.
Neither source's commercial-reuse terms have been separately negotiated by this project --
this document exists so that is an explicit, visible decision point rather than a silent
assumption, matching docs/ATP_DATA_ATTRIBUTION.md's existing precedent for the ATP Main/
Challenger historical dataset (also Jeff Sackmann-sourced, also CC BY-NC-SA 4.0).

## 1. Canonical historical match record (identity/result ground truth)

Source: https://github.com/JeffSackmann/tennis_wta (mirrored at
https://github.com/Aneeshers/tennis-sackmann-archive, `wta/wta_matches_<year>.csv`)
License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
Attribution: Tennis databases, files, and algorithms by Jeff Sackmann / Tennis Abstract.

Used only to establish canonical match identity (players, date, tournament, round, score) that
a PBP candidate is cross-checked against -- not itself a point-by-point source. Same license and
same "non-commercial/free use only" status as the ATP Main/Challenger historical ingestion this
project already runs (docs/ATP_DATA_ATTRIBUTION.md).

## 2. Non-Slam WTA Main point-by-point (2011-2015): ppaulojr/tennis_pointbypoint

Source: https://github.com/ppaulojr/tennis_pointbypoint (`pbp_matches_wta_main_archive.csv`,
`pbp_matches_wta_main_current.csv`)
License: **No LICENSE file or license statement of any kind is present in this repository.**
This is a materially different (weaker) position than the other three sources cited here, which
all carry an explicit license. The repository's own README describes it as a compiled/scraped
aggregation of point sequences ("Sequential point-by-point data for tens of thousands of pro
matches ... Compiling, parsing, and cleaning up this rather messy dataset has been an enormous
task") without stating terms of reuse. This project's own existing pipeline code
(scripts/verify-sackmann-pbp-v4.py, predates this task) already names this exact repository as
its PBP source for both ATP and WTA, which is evidence of prior engineering intent to use it, but
is not the same as a confirmed license.

**Recommendation: do not rely on this source for a commercial/monetized code path until its
reuse terms are confirmed directly with the maintainer, or the data is replaced with a
commercially-licensed equivalent.** Treat it the same as this project's other
`NONCOMMERCIAL_ONLY`-tagged sources (src/lib/yellow-metric-sources.ts section 16; the Match
Charting Project entry there is the existing precedent for exactly this posture) until that
review happens.

## 3. Grand Slam WTA Main point-by-point (2016-2024): Jeff Sackmann tennis_slam_pointbypoint

Source: https://github.com/JeffSackmann/tennis_slam_pointbypoint (mirrored at
https://github.com/Aneeshers/tennis-sackmann-archive, `slam_pointbypoint/`)
License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
Attribution: Tennis databases, files, and algorithms by Jeff Sackmann / Tennis Abstract, and the
volunteer contributors who charted/logged the underlying Grand Slam point sequences.

## Independent verification source (non-Slam lane only)

The non-Slam lane (source 2 above) additionally requires an independent, differently-licensed
result record to agree with the PBP candidate before a match is marked verified: the already-
existing local sync `data/public/tennis-data-wta/wta_matches_2007_2016.csv`
(`.github/workflows/sync-tennis-data-wta.yml`, Tennis-Data.co.uk, stated by that source as free
to use -- see that workflow's own SOURCE.md for terms). This does not change the reuse status of
the PBP data itself; it only raises confidence that the PBP candidate is correctly identified.

## Status

This integration, like the ATP historical ingestion it parallels, is intended only for the
app's current non-commercial/free use pending that review. **Do not use this WTA Main historical
PBP dataset (either lane) in a commercial or monetized version without completing the license
review above.**
