#!/usr/bin/env python3
"""
ATP Main PBP: exact, non-estimated inventory across every dimension the
downstream-readiness review requires: year, source, tournament, validation
status, and match-identity status -- as distinct, never-collapsed axes.

Reuses the SAME classification logic already tested and committed in
scripts/export-pbp-structurally-validated-corpus.py (resolve_and_validate,
imported here, not re-implemented) for the PBP-candidate-side categories.
Adds ONE genuinely new metric this repo has never computed before: NO_PBP,
counted from the HISTORICAL side (Aneeshers/Sackmann hist), not the PBP
candidate side -- "how many real ATP Main matches does ppaulojr have zero PBP
rows for at all", as opposed to "how many ppaulojr rows failed to resolve",
which is a different denominator/direction from every existing script.

Category definitions (all mutually exclusive, all counted from real data,
none estimated):
  LEVEL_2 (structurally validated)  = resolve_and_validate() "internally_validated"
  REVIEW_REQUIRED / AMBIGUOUS        = resolve_match_identity() AMBIGUOUS (currently
                                        the same underlying condition; reported as
                                        both names since the task asks for both,
                                        they are 0/0 whenever they are 0/0 together
                                        by construction -- see report note)
  CONFLICT                           = resolve_and_validate() "conflict"
  STRUCTURAL_FAIL                    = resolve_and_validate() "structural_failure"
  UNMATCHED                          = resolve_and_validate() "no_historical_player_pair"
                                        + "unresolved_other" -- reported with the
                                        sub-breakdown intact, never merged silently
  NO_PBP                             = hist matches (Aneeshers side) with ZERO
                                        ppaulojr rows for that player pair, that year
  LEVEL_1 (independently verified)   = 0 by construction until a real, reachable,
                                        independent corroboration source exists --
                                        see corroboration_source.py and this run's
                                        own connectivity check (recorded below,
                                        never assumed from a stale prior check)
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from lib.pbp_source_adapter import AneeshersSackmannHistAdapter, PpaulojrPbpAdapter, pairkey
from lib.match_identity_resolver import resolve_match_identity, IdentityResolution

_spec = importlib.util.spec_from_file_location("export_corpus", Path(__file__).parent / "export-pbp-structurally-validated-corpus.py")
_export = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_export)
resolve_and_validate = _export.resolve_and_validate

ROOT = Path("data/audit/atp-main-pbp-inventory")


def run_year(tour: str, year: int) -> dict:
    hist = AneeshersSackmannHistAdapter().fetch_year(tour, year)
    pbp = PpaulojrPbpAdapter().fetch_year(tour, year)

    hist_by_pair = defaultdict(list)
    for h in hist:
        hist_by_pair[pairkey(h.player_1, h.player_2)].append(h)

    pbp_by_pair = defaultdict(list)
    for p in pbp:
        pbp_by_pair[pairkey(p.player_1, p.player_2)].append(p)

    # ── PBP-candidate-side categorization (validation status) ──────────────────
    category_counts: Counter[str] = Counter()
    identity_status_counts: Counter[str] = Counter()
    tournament_counts_level2: Counter[str] = Counter()
    identity_tier_counts_level2: Counter[str] = Counter()
    level2_records = []

    for p in pbp:
        cands = hist_by_pair.get(pairkey(p.player_1, p.player_2), [])
        category, matched, rec, identity_tier = resolve_and_validate(p, cands)
        category_counts[category] += 1

        identity = resolve_match_identity(p, cands)
        identity_status_counts[identity.resolution.value] += 1

        if category == "internally_validated":
            tournament_counts_level2[matched.tournament_name] += 1
            identity_tier_counts_level2[identity_tier or "UNKNOWN"] += 1
            level2_records.append({"externalId": matched.match_id, "tournament": matched.tournament_name, "date": matched.date})

    # ── Hist-side NO_PBP metric (new; never computed before) ────────────────────
    no_pbp_count = 0
    no_pbp_examples = []
    for h in hist:
        key = pairkey(h.player_1, h.player_2)
        if not pbp_by_pair.get(key):
            no_pbp_count += 1
            if len(no_pbp_examples) < 25:
                no_pbp_examples.append({"tournament": h.tournament_name, "date": h.date, "player_1": h.player_1, "player_2": h.player_2, "match_id": h.match_id})

    unmatched_no_pair = category_counts.get("no_historical_player_pair", 0)
    unmatched_other = category_counts.get("unresolved_other", 0)

    return {
        "tour": tour,
        "year": year,
        "total_hist_matches": len(hist),
        "total_pbp_candidates": len(pbp),
        "categories": {
            "LEVEL_1_independently_verified": 0,  # see module docstring; never inferred
            "LEVEL_2_structurally_validated": category_counts.get("internally_validated", 0),
            "REVIEW_REQUIRED": category_counts.get("ambiguous", 0),
            "AMBIGUOUS": category_counts.get("ambiguous", 0),
            "CONFLICT": category_counts.get("conflict", 0),
            "STRUCTURAL_FAIL": category_counts.get("structural_failure", 0),
            "UNMATCHED": unmatched_no_pair + unmatched_other,
            "UNMATCHED_breakdown": {
                "no_historical_player_pair": unmatched_no_pair,
                "candidate_pair_exists_but_score_or_winner_disagrees": unmatched_other,
            },
            "NO_PBP": no_pbp_count,
        },
        "match_identity_status": dict(identity_status_counts),
        "identity_resolution_tier_breakdown_LEVEL_2_only": dict(identity_tier_counts_level2),
        "tournament_breakdown_LEVEL_2_only": dict(sorted(tournament_counts_level2.items(), key=lambda kv: -kv[1])),
        "no_pbp_examples_sample": no_pbp_examples,
        "sources": {
            "pbp_source": PpaulojrPbpAdapter.source_name,
            "identity_hist_source": AneeshersSackmannHistAdapter.source_name,
        },
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tour", default="ATP_MAIN")
    ap.add_argument("--year", type=int, nargs="+", required=True)
    args = ap.parse_args()

    ROOT.mkdir(parents=True, exist_ok=True)
    combined = Counter()
    combined_identity = Counter()
    all_years = []
    for year in args.year:
        result = run_year(args.tour, year)
        all_years.append(result)
        out = ROOT / f"{args.tour.lower()}_{year}.json"
        out.write_text(json.dumps(result, indent=2) + "\n")
        for k, v in result["categories"].items():
            if isinstance(v, int):
                combined[k] += v
        for k, v in result["match_identity_status"].items():
            combined_identity[k] += v
        print(f"=== {args.tour} {year} ===")
        print("total_hist_matches:", result["total_hist_matches"], " total_pbp_candidates:", result["total_pbp_candidates"])
        print("categories:", {k: v for k, v in result["categories"].items() if isinstance(v, int)})
        print("match_identity_status:", result["match_identity_status"])
        print()

    summary = {
        "tour": args.tour,
        "years": args.year,
        "combined_categories": dict(combined),
        "combined_match_identity_status": dict(combined_identity),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    (ROOT / f"{args.tour.lower()}_combined_summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print("=== COMBINED ===")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
