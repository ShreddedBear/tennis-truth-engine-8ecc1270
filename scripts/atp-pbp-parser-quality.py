#!/usr/bin/env python3
"""
ATP main-tour PBP parser quality audit (Task: multi-source PBP integration, Phase 8).

Read-only diagnostic that explains WHY candidates fail at each stage of the
overlap experiment (scripts/atp-pbp-source-overlap.py) -- it does not change
any validation classification or existing funnel counts, only breaks down the
"lost" candidates between stages into concrete failure reasons.

Usage: python3 scripts/atp-pbp-parser-quality.py --year 2012 2013
"""
from __future__ import annotations
import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from lib.pbp_source_adapter import (
    AneeshersSackmannHistAdapter,
    PpaulojrPbpAdapter,
    PBPRecord,
    pairkey,
    tny_ok,
    norm_name,
    score_games,
    reconstruct_pbp,
)

ROOT = Path("data/audit/pbp-parser-quality")


def find_best_hist_match(p: PBPRecord, hist_candidates: list[PBPRecord]) -> tuple[PBPRecord | None, list[str] | None]:
    """Pure identity-matching logic, extracted for unit testing without network access.

    Returns (matched_hist, None) on a clean match (score+tournament+winner all agree),
    or (None, reasons) with the disagreement reasons of the CLOSEST candidate (fewest
    mismatches) when no hist candidate fully agrees. `hist_candidates` must be
    non-empty (caller handles the "no historical player pair at all" case separately).
    """
    best_reason: list[str] | None = None
    for h in hist_candidates:
        reasons_here = []
        if p.score and h.score and score_games(p.score) != score_games(h.score):
            reasons_here.append("SCORE_MISMATCH")
        if not tny_ok(h.tournament_name, p.tournament_name):
            reasons_here.append("TOURNAMENT_MISMATCH")
        if norm_name(p.winner) != norm_name(h.winner):
            reasons_here.append("WINNER_MISMATCH")
        if not reasons_here:
            return h, None
        if best_reason is None or len(reasons_here) < len(best_reason):
            best_reason = reasons_here
    return None, (best_reason or ["UNKNOWN"])


def run_year(tour: str, year: int) -> dict:
    hist = AneeshersSackmannHistAdapter().fetch_year(tour, year)
    pbp = PpaulojrPbpAdapter().fetch_year(tour, year)

    by_pair_hist: dict[tuple, list] = defaultdict(list)
    for h in hist:
        by_pair_hist[pairkey(h.player_1, h.player_2)].append(h)

    # Stage 1: player-pair identity
    no_historical_pair = 0          # ppaulojr candidate whose player pair never played (per hist) that year
    identity_reasons: Counter = Counter()

    # Stage 2: score / tournament / winner agreement (per candidate, best-effort across all hist candidates for that pair)
    score_tny_winner_failures: Counter = Counter()  # classifies the BEST (closest) reason a candidate never matched any hist row

    # Stage 3: structural validity (reconstruct_pbp failure reasons)
    structural_failure_reasons: Counter = Counter()

    # Stage 4: internal agreement (reconstructed score/winner vs historical, once structurally valid)
    internal_disagreement_reasons: Counter = Counter()

    unusual_scoring_formats = 0  # candidates whose raw pbp contains characters/patterns outside the documented S/R/A/D/./;// alphabet
    missing_pbp = 0              # candidates with an empty pbp_tape field entirely

    for p in pbp:
        if not (p.pbp_tape or "").strip():
            missing_pbp += 1

        allowed_chars = set("SRAD./;")
        if p.pbp_tape and not set(p.pbp_tape.strip()) <= allowed_chars:
            unusual_scoring_formats += 1

        pk = pairkey(p.player_1, p.player_2)
        hist_candidates = by_pair_hist.get(pk, [])
        if not hist_candidates:
            no_historical_pair += 1
            continue

        matched_hist, failure_reasons = find_best_hist_match(p, hist_candidates)
        if matched_hist is None:
            for r in failure_reasons:
                score_tny_winner_failures[r] += 1
            continue

        rec = reconstruct_pbp(p.pbp_tape or "")
        if not rec.get("valid"):
            structural_failure_reasons[rec.get("reason", "UNKNOWN")] += 1
            continue

        pg = [tuple(x) for x in rec["sets"]]
        if norm_name(matched_hist.winner) == norm_name(p.player_2):
            pg = [(b, a) for a, b in pg]
        score_ok = pg == score_games(matched_hist.score)
        winner_ok = rec["winner"] == (0 if norm_name(matched_hist.winner) == norm_name(p.player_1) else 1)
        if not score_ok:
            internal_disagreement_reasons["RECONSTRUCTED_SCORE_MISMATCH"] += 1
        elif not winner_ok:
            internal_disagreement_reasons["RECONSTRUCTED_WINNER_MISMATCH"] += 1

    return {
        "tour": tour,
        "year": year,
        "candidates": len(pbp),
        "missing_pbp_tape": missing_pbp,
        "unusual_scoring_format_chars": unusual_scoring_formats,
        "no_historical_player_pair": no_historical_pair,
        "score_tournament_winner_mismatch_reasons": dict(score_tny_winner_failures),
        "structural_parse_failure_reasons": dict(structural_failure_reasons),
        "internal_disagreement_after_structural_pass": dict(internal_disagreement_reasons),
        "note": "Counts here explain WHY candidates are lost between overlap-experiment stages; "
                "they do not change or replace the committed funnel counts in "
                "data/audit/pbp-source-overlap/. Reference commit: 9c0ecb6.",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tour", default="ATP_MAIN")
    ap.add_argument("--year", type=int, nargs="+", required=True)
    args = ap.parse_args()

    ROOT.mkdir(parents=True, exist_ok=True)
    for year in args.year:
        summary = run_year(args.tour, year)
        out = ROOT / f"{args.tour.lower()}_{year}.json"
        out.write_text(json.dumps(summary, indent=2) + "\n")
        print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
