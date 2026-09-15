#!/usr/bin/env python3
"""
ATP main-tour PBP source overlap experiment (Task: multi-source PBP integration, Phase 8).

Read-only, no persistence, no independent corroboration (tennis-data.co.uk is
down -- see PBP_SOURCE_LICENSE_AUDIT.md and the outage record in
data/audit/verified-pbp-v4/). This answers: how far can identity + structural
validation alone get us, with the two currently-integrated sources
(Aneeshers hist + ppaulojr PBP), before independent corroboration is needed?

Funnel stages reported (never collapsed into one number):
  candidates              -- raw PBP records fetched from ppaulojr for this year
  normalized              -- candidates that parsed into a well-formed PBPRecord
  player_name_matched     -- candidates whose player pair matches a historical
                             match's player pair (pairkey identity)
  score_and_tny_matched   -- of those, ones where score also matches AND the
                             tournament name fuzzy-matches (tny_ok)
  structurally_valid      -- of those, ones whose raw pbp tape reconstructs to
                             a valid tennis match (reconstruct_pbp)
  internally_validated    -- structurally valid AND score/winner reconstructed
                             from the tape agrees with the historical record
                             (this is everything that does NOT require a third
                             independent source -- pure internal consistency)
  independently_corroborated -- requires tennis-data.co.uk; 0 while it's down
  level_1_verified        -- requires independently_corroborated; 0 while it's down

  duplicates              -- historical matches with >1 internally-validated
                             candidate (ambiguous, would need disambiguation)
  conflicts               -- candidates that structurally validate but whose
                             reconstructed score/winner CONTRADICTS the
                             historical record (real data quality problems)

Usage: python3 scripts/atp-pbp-source-overlap.py --year 2012 2013
"""
from __future__ import annotations
import argparse
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from lib.pbp_source_adapter import (
    AneeshersSackmannHistAdapter,
    PpaulojrPbpAdapter,
    pairkey,
    tny_ok,
    norm_name,
    score_games,
    reconstruct_pbp,
)

ROOT = Path("data/audit/pbp-source-overlap")


def run_year(tour: str, year: int) -> dict:
    hist_adapter = AneeshersSackmannHistAdapter()
    pbp_adapter = PpaulojrPbpAdapter()

    hist = hist_adapter.fetch_year(tour, year)
    pbp = pbp_adapter.fetch_year(tour, year)

    by_pair_hist: dict[tuple, list] = defaultdict(list)
    for h in hist:
        by_pair_hist[pairkey(h.player_1, h.player_2)].append(h)

    normalized = len(pbp)  # every fetched candidate parses into a PBPRecord by construction
    player_name_matched = 0
    score_and_tny_matched = 0
    structurally_valid = 0
    internally_validated = 0
    conflicts = 0
    candidate_matches: dict[str, list] = defaultdict(list)  # historical match_id -> [pbp candidates]

    for p in pbp:
        pk = pairkey(p.player_1, p.player_2)
        hist_candidates = by_pair_hist.get(pk, [])
        if not hist_candidates:
            continue
        player_name_matched += 1

        for h in hist_candidates:
            if p.score and h.score and score_games(p.score) != score_games(h.score):
                continue
            if not tny_ok(h.tournament_name, p.tournament_name):
                continue
            if norm_name(p.winner) != norm_name(h.winner):
                continue
            score_and_tny_matched += 1

            rec = reconstruct_pbp(p.pbp_tape or "")
            if not rec.get("valid"):
                continue
            structurally_valid += 1

            # Orient reconstructed sets to h's winner-perspective and compare.
            pg = [tuple(x) for x in rec["sets"]]
            if norm_name(h.winner) == norm_name(p.player_2):
                pg = [(b, a) for a, b in pg]
            reconstructed_score_matches = pg == score_games(h.score)
            reconstructed_winner = 0 if norm_name(h.winner) == norm_name(p.player_1) else 1
            reconstructed_winner_matches = rec["winner"] == reconstructed_winner

            if reconstructed_score_matches and reconstructed_winner_matches:
                internally_validated += 1
                candidate_matches[h.match_id].append(p)
            else:
                conflicts += 1

    duplicates = sum(1 for v in candidate_matches.values() if len(v) > 1)

    summary = {
        "tour": tour,
        "year": year,
        "sources": {
            "hist": {"name": hist_adapter.source_name, "license": hist_adapter.license_status.value, "raw_records": len(hist)},
            "pbp": {"name": pbp_adapter.source_name, "license": pbp_adapter.license_status.value, "raw_records": len(pbp)},
        },
        "funnel": {
            "candidates": len(pbp),
            "normalized": normalized,
            "player_name_matched": player_name_matched,
            "score_and_tny_matched": score_and_tny_matched,
            "structurally_valid": structurally_valid,
            "internally_validated": internally_validated,
            "independently_corroborated": 0,
            "level_1_verified": 0,
        },
        "duplicates_ambiguous_historical_matches": duplicates,
        "conflicts_structurally_valid_but_disagrees_with_history": conflicts,
        "independent_corroboration_blocker": "tennis-data.co.uk unreachable (see data/audit/verified-pbp-v4 outage record) -- 0 records can reach LEVEL_1 until this or another independent source is available",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    return summary


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tour", default="ATP_MAIN")
    ap.add_argument("--year", type=int, nargs="+", required=True)
    args = ap.parse_args()

    ROOT.mkdir(parents=True, exist_ok=True)
    results = []
    for year in args.year:
        summary = run_year(args.tour, year)
        results.append(summary)
        out = ROOT / f"{args.tour.lower()}_{year}.json"
        out.write_text(json.dumps(summary, indent=2) + "\n")
        print(json.dumps(summary, indent=2))

    (ROOT / "README.md").write_text(
        "# ATP main-tour PBP source overlap experiment\n\n"
        "Read-only funnel analysis, no persistence, no independent corroboration "
        "(tennis-data.co.uk down). Run: `python3 scripts/atp-pbp-source-overlap.py "
        "--year 2012 2013`. See PBP_SOURCE_LICENSE_AUDIT.md for source licensing.\n"
    )


if __name__ == "__main__":
    main()
