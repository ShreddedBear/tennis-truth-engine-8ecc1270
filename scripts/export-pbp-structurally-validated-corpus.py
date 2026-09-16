#!/usr/bin/env python3
"""
Full-corpus export of the STRUCTURALLY_VALIDATED PBP records (currently 4,065
for ATP_MAIN 2012+2013 -- 1,919 + 2,146, exactly matching the counts already
reported in docs/INDEPENDENT_CORROBORATION.md section 8 and produced by
scripts/atp-pbp-identity-resolution-experiment.py's "internally_validated"
bucket, whose exact classification logic this script reuses unmodified).

Unlike atp-pbp-identity-resolution-experiment.py (which reports before/after
COUNTS and a 50-example sample), this script exports the FULL per-record
detail needed for tennis-stats-engine to import each record as a `pbp_evidence`
row: the raw PBP tape + hash, the structural reconstruction, and the exact
(provider, externalId) identity key tennis-stats-engine's OWN
sackmannBackfill.ts already uses for its `historical_matches` rows --
`externalId = f"{tourney_id}-{match_num}"`, `provider = "sackmann"` -- so the
importer can resolve each record to its existing historical_matches row by a
simple lookup, with NO re-derivation of match identity on the stats-engine
side (identity resolution happens exactly once, here, in tennis-truth-engine).

Never promotes anything: every exported record's validationLevel is
hardcoded to STRUCTURALLY_VALIDATED (this script only ever runs the
identity-resolution + structural-reconstruction path, the same one that
currently caps every one of these records at that level -- see
verification_status.py for the levels above it, none of which this script
touches). licenseStatus is copied verbatim from PpaulojrPbpAdapter
(LICENSE_UNCERTAIN) -- never upgraded, never silently dropped.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from lib.pbp_source_adapter import (
    AneeshersSackmannHistAdapter, PpaulojrPbpAdapter,
    pairkey, norm_name, score_games, reconstruct_pbp,
)
from lib.match_identity_resolver import resolve_match_identity, IdentityResolution

ROOT = Path("data/audit/pbp-structurally-validated-export")


def resolve_and_validate(p, hist_candidates):
    """Identical logic to atp-pbp-identity-resolution-experiment.py's classify_new,
    returning (category, matched_hist_record_or_None, reconstructed_dict_or_None).
    Kept in lock-step with that script deliberately -- this is the SAME
    classification, just also carrying the reconstruction dict + matched hist
    record forward instead of discarding them into a count."""
    result = resolve_match_identity(p, hist_candidates)
    if result.resolution == IdentityResolution.UNRESOLVED:
        return ("no_historical_player_pair" if not hist_candidates else "unresolved_other"), None, None
    if result.resolution == IdentityResolution.AMBIGUOUS:
        return "ambiguous", None, None

    matched = result.matched
    rec = reconstruct_pbp(p.pbp_tape or "")
    if not rec.get("valid"):
        return "structural_failure", None, rec

    pg = [tuple(x) for x in rec["sets"]]
    if norm_name(matched.winner) == norm_name(p.player_2):
        pg = [(b, a) for a, b in pg]
    score_ok = pg == score_games(matched.score)
    winner_ok = rec["winner"] == (0 if norm_name(matched.winner) == norm_name(p.player_1) else 1)
    if score_ok and winner_ok:
        return "internally_validated", matched, rec
    return "conflict", matched, rec


def export_year(tour: str, year: int) -> dict:
    hist = AneeshersSackmannHistAdapter().fetch_year(tour, year)
    pbp = PpaulojrPbpAdapter().fetch_year(tour, year)
    by_pair = defaultdict(list)
    for h in hist:
        by_pair[pairkey(h.player_1, h.player_2)].append(h)

    records = []
    category_counts: dict[str, int] = defaultdict(int)

    for p in pbp:
        cands = by_pair.get(pairkey(p.player_1, p.player_2), [])
        category, matched, rec = resolve_and_validate(p, cands)
        category_counts[category] += 1
        if category != "internally_validated":
            continue

        # matched.match_id is already f"{tourney_id}-{match_num}" (see
        # AneeshersSackmannHistAdapter) -- exactly tennis-stats-engine's own
        # externalId convention (sackmannBackfill.ts's rowToFixture). No
        # re-derivation needed; copied verbatim.
        external_id = matched.match_id
        winner_id = matched.provenance.get("winner_id")
        loser_id = matched.provenance.get("loser_id")

        raw_tape = p.pbp_tape or ""
        records.append({
            # Identity key for tennis-stats-engine's historical_matches FK lookup.
            "provider": "sackmann",
            "externalId": external_id,
            "sackmannWinnerId": winner_id,
            "sackmannLoserId": loser_id,
            "tour": tour,
            "year": year,
            "tournamentId": matched.tournament_id,
            "tournamentName": matched.tournament_name,
            "date": matched.date,
            "player1": p.player_1,
            "player2": p.player_2,
            "winner": matched.winner,
            "score": matched.score,
            # Raw PBP evidence -- exactly as pulled from the source, never edited.
            "pbpSourceRepo": p.source,
            "pbpSourceFile": p.provenance.get("source_file"),
            "pbpSourceRow": p.provenance.get("source_row"),
            "pbpRaw": raw_tape,
            "pbpSha256": p.provenance.get("pbp_sha256") or hashlib.sha256(raw_tape.encode()).hexdigest(),
            "reconstructed": rec,
            "verifierVersion": PpaulojrPbpAdapter.source_version,
            # Axis B (never upgraded by this script) and axis C, copied verbatim.
            "validationLevel": "STRUCTURALLY_VALIDATED",
            "licenseStatus": "LICENSE_UNCERTAIN",  # PpaulojrPbpAdapter.license_status.value
        })

    return {
        "tour": tour,
        "year": year,
        "category_counts": dict(category_counts),
        "exported_count": len(records),
        "records": records,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tour", default="ATP_MAIN")
    ap.add_argument("--year", type=int, nargs="+", required=True)
    args = ap.parse_args()

    ROOT.mkdir(parents=True, exist_ok=True)
    total_exported = 0
    for year in args.year:
        result = export_year(args.tour, year)
        out = ROOT / f"{args.tour.lower()}_{year}.json"
        out.write_text(json.dumps(result, indent=2) + "\n")
        total_exported += result["exported_count"]
        print(f"=== {args.tour} {year} ===")
        print("category_counts:", result["category_counts"])
        print("exported_count (STRUCTURALLY_VALIDATED):", result["exported_count"])
        print()

    print(f"TOTAL exported across all requested years: {total_exported}")


if __name__ == "__main__":
    main()
