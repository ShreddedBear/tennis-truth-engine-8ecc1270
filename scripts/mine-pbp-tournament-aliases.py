#!/usr/bin/env python3
"""
Mines candidate tournament-name aliases from real ATP_MAIN PBP data (Task:
match-identity reconciliation). Read-only, no persistence beyond its own
output file -- this is the audit trail for
scripts/lib/match_identity_resolver.py's TOURNAMENT_ALIAS_TABLE, which is
hand-curated FROM this script's output, not auto-applied.

Methodology: for every ppaulojr candidate that find_best_hist_match (the
already-tested production classifier) reports as failing for EXACTLY the
reason ['TOURNAMENT_MISMATCH'] (i.e. score and winner both independently
agree, only the tournament name disagrees), record the (ppaulojr_name,
hist_name) pair. A pair that recurs is strong, cross-validated evidence of a
real tournament-name variant. A pair seen exactly once is exactly as likely
to be a coincidental score+winner collision against the WRONG historical
match for a player pair that met more than once that year -- this script
flags (does not silently drop) that distinction with the --min-occurrences
threshold (default 2).

Usage: python3 scripts/mine-pbp-tournament-aliases.py --year 2012 2013
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from collections import defaultdict
from pathlib import Path

from lib.pbp_source_adapter import AneeshersSackmannHistAdapter, PpaulojrPbpAdapter, pairkey, score_games, norm_name

_spec = importlib.util.spec_from_file_location("pq", Path(__file__).parent / "atp-pbp-parser-quality.py")
_pq = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pq)
find_best_hist_match = _pq.find_best_hist_match


def mine(tour: str, years: list[int]) -> dict[tuple[str, str], int]:
    combined: dict[tuple[str, str], int] = defaultdict(int)
    for year in years:
        hist = AneeshersSackmannHistAdapter().fetch_year(tour, year)
        pbp = PpaulojrPbpAdapter().fetch_year(tour, year)
        by_pair = defaultdict(list)
        for h in hist:
            by_pair[pairkey(h.player_1, h.player_2)].append(h)
        for p in pbp:
            cands = by_pair.get(pairkey(p.player_1, p.player_2), [])
            if not cands:
                continue
            matched, reasons = find_best_hist_match(p, cands)
            if matched is not None or reasons != ["TOURNAMENT_MISMATCH"]:
                continue
            for h in cands:
                if p.score and h.score and score_games(p.score) != score_games(h.score):
                    continue
                if norm_name(p.winner) != norm_name(h.winner):
                    continue
                combined[(p.tournament_name, h.tournament_name)] += 1
    return combined


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tour", default="ATP_MAIN")
    ap.add_argument("--year", type=int, nargs="+", required=True)
    ap.add_argument("--min-occurrences", type=int, default=2)
    args = ap.parse_args()

    combined = mine(args.tour, args.year)
    trusted = {f"{k[0]} -> {k[1]}": v for k, v in combined.items() if v >= args.min_occurrences}
    excluded = {f"{k[0]} -> {k[1]}": v for k, v in combined.items() if v < args.min_occurrences}

    out_dir = Path("data/audit/pbp-tournament-alias-mining")
    out_dir.mkdir(parents=True, exist_ok=True)
    result = {
        "tour": args.tour, "years": args.year, "min_occurrences_threshold": args.min_occurrences,
        "trusted_pairs": trusted, "excluded_as_untrusted_singleton_or_below_threshold": excluded,
        "note": "trusted_pairs is the evidence trail for match_identity_resolver.py's "
                "TOURNAMENT_ALIAS_TABLE -- that table is hand-reviewed FROM this output, "
                "never auto-applied without review.",
    }
    (out_dir / f"{args.tour.lower()}_{'_'.join(map(str, args.year))}.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
