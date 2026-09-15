#!/usr/bin/env python3
"""
Before/after experiment for the new match-identity resolver (Task: PBP
match-identity reconciliation). Read-only, no persistence to production, does
NOT modify scripts/atp-pbp-source-overlap.py or scripts/atp-pbp-parser-quality.py
or any of their committed output -- the old results in
data/audit/pbp-source-overlap/ and data/audit/pbp-parser-quality/ remain
exactly as they were and remain independently reproducible.

For every ATP_MAIN candidate in the given year(s):
  OLD = the existing, already-tested classification (find_best_hist_match +
        reconstruct_pbp), reproduced here read-only for comparison.
  NEW = scripts/lib/match_identity_resolver.resolve_match_identity, followed
        by the SAME structural/internal validation step as OLD once identity
        is RESOLVED (never for AMBIGUOUS or UNRESOLVED).

Reports, per year: old category counts, new category counts, and the exact
set of candidates that moved category (recovered / newly ambiguous / newly
conflicting), never just a net delta -- a net-zero delta could hide a
recovery and a new false positive canceling out, which this must never do.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from lib.pbp_source_adapter import AneeshersSackmannHistAdapter, PpaulojrPbpAdapter, pairkey, norm_name, score_games, reconstruct_pbp
from lib.match_identity_resolver import resolve_match_identity, IdentityResolution

_spec = importlib.util.spec_from_file_location("pq", Path(__file__).parent / "atp-pbp-parser-quality.py")
_pq = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pq)
find_best_hist_match = _pq.find_best_hist_match

ROOT = Path("data/audit/pbp-identity-resolution-experiment")


def classify_old(p, hist_candidates) -> tuple[str, object]:
    """Reproduces the EXACT existing classification logic, read-only."""
    if not hist_candidates:
        return "no_historical_player_pair", None
    matched, reasons = find_best_hist_match(p, hist_candidates)
    if matched is None:
        # find_best_hist_match returns the reasons of the closest candidate;
        # categorize by the single most specific reason for reporting.
        if "SCORE_MISMATCH" in reasons:
            return "score_mismatch", None
        if "WINNER_MISMATCH" in reasons:
            return "winner_mismatch", None
        return "tournament_mismatch", None
    rec = reconstruct_pbp(p.pbp_tape or "")
    if not rec.get("valid"):
        return "structural_failure", None
    pg = [tuple(x) for x in rec["sets"]]
    if norm_name(matched.winner) == norm_name(p.player_2):
        pg = [(b, a) for a, b in pg]
    score_ok = pg == score_games(matched.score)
    winner_ok = rec["winner"] == (0 if norm_name(matched.winner) == norm_name(p.player_1) else 1)
    if score_ok and winner_ok:
        return "internally_validated", matched
    return "conflict", matched


def classify_new(p, hist_candidates) -> tuple[str, object]:
    result = resolve_match_identity(p, hist_candidates)
    if result.resolution == IdentityResolution.UNRESOLVED:
        if not hist_candidates:
            return "no_historical_player_pair", None
        return "unresolved_other", None
    if result.resolution == IdentityResolution.AMBIGUOUS:
        return "ambiguous", result.candidates
    # RESOLVED: run the SAME structural/internal validation as old, on the newly-resolved identity
    matched = result.matched
    rec = reconstruct_pbp(p.pbp_tape or "")
    if not rec.get("valid"):
        return "structural_failure", None
    pg = [tuple(x) for x in rec["sets"]]
    if norm_name(matched.winner) == norm_name(p.player_2):
        pg = [(b, a) for a, b in pg]
    score_ok = pg == score_games(matched.score)
    winner_ok = rec["winner"] == (0 if norm_name(matched.winner) == norm_name(p.player_1) else 1)
    if score_ok and winner_ok:
        return "internally_validated", matched
    return "conflict", matched


def run_year(tour: str, year: int) -> dict:
    hist = AneeshersSackmannHistAdapter().fetch_year(tour, year)
    pbp = PpaulojrPbpAdapter().fetch_year(tour, year)
    by_pair = defaultdict(list)
    for h in hist:
        by_pair[pairkey(h.player_1, h.player_2)].append(h)

    old_counts: dict[str, int] = defaultdict(int)
    new_counts: dict[str, int] = defaultdict(int)
    transitions: dict[tuple[str, str], int] = defaultdict(int)
    recovered_examples = []
    newly_ambiguous_examples = []
    newly_conflicting_examples = []

    for p in pbp:
        cands = by_pair.get(pairkey(p.player_1, p.player_2), [])
        old_cat, old_matched = classify_old(p, cands)
        new_cat, new_matched = classify_new(p, cands)
        old_counts[old_cat] += 1
        new_counts[new_cat] += 1
        transitions[(old_cat, new_cat)] += 1

        if old_cat != "internally_validated" and new_cat == "internally_validated":
            recovered_examples.append({
                "player_1": p.player_1, "player_2": p.player_2,
                "ppaulojr_tournament": p.tournament_name, "date": p.date,
                "old_category": old_cat,
                "resolved_hist_tournament": new_matched.tournament_name if new_matched else None,
            })
        if old_cat != "ambiguous" and new_cat == "ambiguous":
            newly_ambiguous_examples.append({
                "player_1": p.player_1, "player_2": p.player_2,
                "ppaulojr_tournament": p.tournament_name, "date": p.date,
                "old_category": old_cat,
            })
        if old_cat != "conflict" and new_cat == "conflict":
            newly_conflicting_examples.append({
                "player_1": p.player_1, "player_2": p.player_2,
                "ppaulojr_tournament": p.tournament_name, "date": p.date,
                "old_category": old_cat,
            })

    return {
        "tour": tour, "year": year,
        "old_counts": dict(old_counts),
        "new_counts": dict(new_counts),
        "transitions": {f"{a} -> {b}": n for (a, b), n in sorted(transitions.items(), key=lambda x: -x[1])},
        "recovered_count": len(recovered_examples),
        "recovered_examples_sample": recovered_examples[:50],
        "newly_ambiguous_count": len(newly_ambiguous_examples),
        "newly_ambiguous_examples": newly_ambiguous_examples,
        "newly_conflicting_count": len(newly_conflicting_examples),
        "newly_conflicting_examples": newly_conflicting_examples,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tour", default="ATP_MAIN")
    ap.add_argument("--year", type=int, nargs="+", required=True)
    args = ap.parse_args()

    ROOT.mkdir(parents=True, exist_ok=True)
    for year in args.year:
        result = run_year(args.tour, year)
        out = ROOT / f"{args.tour.lower()}_{year}.json"
        out.write_text(json.dumps(result, indent=2) + "\n")
        print(f"=== {args.tour} {year} ===")
        print("OLD:", result["old_counts"])
        print("NEW:", result["new_counts"])
        print("Recovered:", result["recovered_count"], "| New ambiguous:", result["newly_ambiguous_count"],
              "| New conflicts:", result["newly_conflicting_count"])
        print()


if __name__ == "__main__":
    main()
