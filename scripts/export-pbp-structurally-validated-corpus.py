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
    returning (category, matched_hist_record_or_None, reconstructed_dict_or_None,
    identity_tier_or_None). Kept in lock-step with that script deliberately --
    this is the SAME classification, just also carrying the reconstruction dict,
    matched hist record, and identity-resolution tier forward instead of
    discarding them into a count."""
    result = resolve_match_identity(p, hist_candidates)
    if result.resolution == IdentityResolution.UNRESOLVED:
        return ("no_historical_player_pair" if not hist_candidates else "unresolved_other"), None, None, None
    if result.resolution == IdentityResolution.AMBIGUOUS:
        return "ambiguous", None, None, None

    matched = result.matched
    tier = result.tier.value if result.tier else None
    rec = reconstruct_pbp(p.pbp_tape or "")
    if not rec.get("valid"):
        return "structural_failure", None, rec, tier

    # rec["sets"]/rec["winner"] are in ppaulojr's OWN server1/server2 orientation, which does NOT
    # necessarily agree with `matched`'s (Sackmann's) winner-is-always-player1 convention -- e.g.
    # ppaulojr's player_1 (server1) can be the LOSER of the match. flip_needed captures exactly
    # that: True means ppaulojr's own player_1 was the loser, so both sets and winner must be
    # flipped before this reconstruction can be safely paired with `matched.player_1`/`player_2`
    # (which this module's caller always exports as player1Name/player2Name). Caught by
    # atp-main-pbp-integrity-check.py's score_agrees_with_reconstruction check, which independently
    # re-derives the winner-first orientation from `score` and found the first export of this
    # manifest had NOT applied this flip to the exported `reconstructed` field (only to a local,
    # discarded variable used for the internal score_ok check) -- 1,924 of 4,065 records were
    # affected. Fixed here so the exported `reconstructed.sets`/`winner` are ALWAYS relative to
    # player1Name/player2Name as exported, with no ambiguity for a downstream consumer.
    flip_needed = norm_name(matched.winner) == norm_name(p.player_2)
    pg = [tuple(x) for x in rec["sets"]]
    if flip_needed:
        pg = [(b, a) for a, b in pg]
    score_ok = pg == score_games(matched.score)
    winner_ok = rec["winner"] == (0 if norm_name(matched.winner) == norm_name(p.player_1) else 1)
    if not (score_ok and winner_ok):
        return "conflict", matched, rec, tier

    canonical_rec = dict(rec)
    canonical_rec["sets"] = [list(s) for s in pg]
    canonical_rec["winner"] = 0  # player1Name (=matched.player_1, the winner) always wins in this frame
    return "internally_validated", matched, canonical_rec, tier


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
        category, matched, rec, identity_tier = resolve_and_validate(p, cands)
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
            "tour": "ATP" if tour == "ATP_MAIN" else tour,  # ATP/WTA tour designation, not the internal ATP_MAIN label
            "year": year,
            "tournamentId": matched.tournament_id,
            "tournamentName": matched.tournament_name,
            "date": matched.date,
            "round": matched.round,
            "surface": matched.surface,
            "level": matched.level,
            # Player identity: from `matched` (the canonical identity-source record), NOT
            # ppaulojr's own player_1/player_2 -- Sackmann's convention (which tennis-stats-engine's
            # sackmannBackfill.ts also follows) is winner is always "player1". Using ppaulojr's own
            # ordering here would silently disagree with that convention for any match ppaulojr
            # lists loser-first.
            "player1Name": matched.player_1,
            "player2Name": matched.player_2,
            "player1Id": f"sackmann-{winner_id}" if winner_id else None,
            "player2Id": f"sackmann-{loser_id}" if loser_id else None,
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
            # Identity/provenance for the axis this record's canonical match came from -- kept
            # distinct from the PBP source above (they are two different sources with two
            # different roles: CORROBORATOR/identity vs PBP_SOURCE).
            "identitySourceName": AneeshersSackmannHistAdapter.source_name,
            "identitySourceLicense": AneeshersSackmannHistAdapter.license_status.value,
            "identityResolutionTier": identity_tier,
            # Axis B (never upgraded by this script) and axis C, copied verbatim.
            "validationLevel": "STRUCTURALLY_VALIDATED",
            "licenseStatus": "LICENSE_UNCERTAIN",  # PpaulojrPbpAdapter.license_status.value
            # Cutoff metadata: truth-engine does not itself compute a cutoff timestamp (that is a
            # deployment-configured, downstream concept -- see tennis-stats-engine's
            # historicalMatchesTable.cutoffMinutes/cutoffAt). What this record DOES assert,
            # authoritatively, is the real-world date this match was played (`date` above) --
            # the fact a downstream cutoff computation must be based on. A downstream consumer
            # must never treat this record as available before that date.
            "cutoffBasisDate": matched.date,
        })

    # De-duplicate by (provider, externalId) -- see docs/PBP_SOURCE_LICENSE_AUDIT.md and this
    # script's own commit history: ppaulojr's own source CSV genuinely lists the same real match
    # twice in a small number of cases (17 across 2012+2013), each time with a different PBP tape
    # that independently passes structural validation. An "approved manifest" must have exactly one
    # row per canonical match -- the deterministic tie-break (lowest pbpSourceRow kept) mirrors
    # tennis-stats-engine's own importPbpEvidence.ts dedupeByExternalId(), so both layers agree,
    # but doing it HERE means the manifest itself is already clean for any downstream consumer,
    # not only the one this session already built. Every discarded duplicate is reported, never
    # silently dropped.
    by_key: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_key[f"{r['provider']}:{r['externalId']}"].append(r)
    deduped = []
    discarded_duplicates = []
    for group in by_key.values():
        group_sorted = sorted(group, key=lambda r: r["pbpSourceRow"])
        deduped.append(group_sorted[0])
        for extra in group_sorted[1:]:
            discarded_duplicates.append({
                "externalId": extra["externalId"],
                "keptSourceRow": group_sorted[0]["pbpSourceRow"],
                "discardedSourceRow": extra["pbpSourceRow"],
                "keptSha256": group_sorted[0]["pbpSha256"],
                "discardedSha256": extra["pbpSha256"],
            })

    return {
        "tour": tour,
        "year": year,
        "category_counts": dict(category_counts),
        "exported_count": len(deduped),
        "duplicate_canonical_matches_found": len(discarded_duplicates),
        "discarded_duplicates": discarded_duplicates,
        "records": deduped,
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
        print("exported_count (STRUCTURALLY_VALIDATED, deduplicated):", result["exported_count"])
        print("duplicate_canonical_matches_found (discarded):", result["duplicate_canonical_matches_found"])
        print()

    print(f"TOTAL exported across all requested years: {total_exported}")


if __name__ == "__main__":
    main()
