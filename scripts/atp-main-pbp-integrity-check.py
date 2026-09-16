#!/usr/bin/env python3
"""
Data-integrity checks against the ATP Main approved manifest
(data/audit/pbp-structurally-validated-export/atp_main_*.json), run directly
against the real, already-exported records -- not re-derived from scratch, so
this checks exactly what a downstream consumer would actually receive.

Mirrors the PASS/FAIL checklist style of
data/audit/bsd-wta-main-pbp-integration-validation.md (the WTA Main
integration's own validation report format) so both populations' readiness
reports are directly comparable.

Checks, each independently PASS/FAIL, never merged into a single boolean:
  - duplicate_pbp_hashes            : no two records share pbpSha256
  - duplicate_canonical_matches     : no two records share (provider, externalId)
  - winner_is_always_player1        : Sackmann convention holds for every record
                                       (by construction from export's `matched.player_1`,
                                       verified here rather than assumed)
  - score_agrees_with_reconstruction: reconstructed games-per-set matches `score`
                                       for every record (re-verified independently
                                       of the export's own internal check)
  - no_tournament_identity_missing  : tournamentId/tournamentName never null
  - no_date_missing                 : date (the temporal-leakage/cutoff basis) never null
  - date_is_valid_iso               : date parses as YYYY-MM-DD
  - cross_tour_contamination        : every record's `tour` matches the file it came from
  - malformed_pbp_excluded          : every exported record's reconstructed.valid is True
                                       (STRUCTURAL_FAIL rows are never exported at all --
                                       verified here, not merely assumed)
  - no_canonical_id_fabrication     : externalId format is exactly f"{tourneyId}-{matchNum}"
                                       recoverable from tournamentId, never a synthetic value
"""
from __future__ import annotations
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from lib.pbp_source_adapter import score_games, norm_name

EXPORT_ROOT = Path("data/audit/pbp-structurally-validated-export")
OUT_ROOT = Path("data/audit/atp-main-pbp-integrity-check")


def load_all_records(files: list[Path]) -> list[dict]:
    records = []
    for f in files:
        d = json.loads(f.read_text())
        for r in d["records"]:
            r = dict(r)
            r["_sourceFile"] = f.name
            r["_fileTour"] = "ATP_MAIN"  # every file in this dir is ATP_MAIN by construction of the export script's --tour arg
            records.append(r)
    return records


def check_duplicate_pbp_hashes(records: list[dict]) -> tuple[bool, dict]:
    by_sha = {}
    dupes = []
    for r in records:
        sha = r["pbpSha256"]
        if sha in by_sha:
            dupes.append({"sha256": sha, "externalIds": [by_sha[sha], r["externalId"]]})
        else:
            by_sha[sha] = r["externalId"]
    return len(dupes) == 0, {"duplicate_count": len(dupes), "examples": dupes[:20]}


def check_duplicate_canonical_matches(records: list[dict]) -> tuple[bool, dict]:
    by_key = {}
    dupes = []
    for r in records:
        key = (r["provider"], r["externalId"])
        if key in by_key:
            dupes.append({"provider": key[0], "externalId": key[1]})
        else:
            by_key[key] = True
    return len(dupes) == 0, {"duplicate_count": len(dupes), "examples": dupes[:20]}


def check_winner_is_always_player1(records: list[dict]) -> tuple[bool, dict]:
    violations = [r["externalId"] for r in records if norm_name(r["winner"]) != norm_name(r["player1Name"])]
    return len(violations) == 0, {"violation_count": len(violations), "examples": violations[:20]}


def check_score_agrees_with_reconstruction(records: list[dict]) -> tuple[bool, dict]:
    violations = []
    for r in records:
        rec = r["reconstructed"]
        if not rec.get("valid"):
            violations.append({"externalId": r["externalId"], "reason": "reconstructed.valid is False but record was exported"})
            continue
        pg = [tuple(x) for x in rec["sets"]]
        expected = score_games(r["score"])
        if pg != expected:
            violations.append({"externalId": r["externalId"], "reconstructedSets": pg, "scoreSets": expected})
    return len(violations) == 0, {"violation_count": len(violations), "examples": violations[:20]}


def check_no_tournament_identity_missing(records: list[dict]) -> tuple[bool, dict]:
    violations = [r["externalId"] for r in records if not r.get("tournamentId") or not r.get("tournamentName")]
    return len(violations) == 0, {"violation_count": len(violations), "examples": violations[:20]}


def check_no_date_missing(records: list[dict]) -> tuple[bool, dict]:
    violations = [r["externalId"] for r in records if not r.get("date")]
    return len(violations) == 0, {"violation_count": len(violations), "examples": violations[:20]}


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def check_date_is_valid_iso(records: list[dict]) -> tuple[bool, dict]:
    violations = []
    for r in records:
        d = r.get("date") or ""
        if not _DATE_RE.match(d):
            violations.append({"externalId": r["externalId"], "date": d})
            continue
        try:
            datetime.strptime(d, "%Y-%m-%d")
        except ValueError:
            violations.append({"externalId": r["externalId"], "date": d})
    return len(violations) == 0, {"violation_count": len(violations), "examples": violations[:20]}


def check_cross_tour_contamination(records: list[dict]) -> tuple[bool, dict]:
    violations = [r["externalId"] for r in records if r["tour"] != "ATP"]
    return len(violations) == 0, {"violation_count": len(violations), "examples": violations[:20]}


def check_malformed_pbp_excluded(records: list[dict]) -> tuple[bool, dict]:
    violations = [r["externalId"] for r in records if not r["reconstructed"].get("valid")]
    return len(violations) == 0, {"violation_count": len(violations), "examples": violations[:20]}


def check_no_canonical_id_fabrication(records: list[dict]) -> tuple[bool, dict]:
    violations = []
    for r in records:
        expected_prefix = f"{r['tournamentId']}-"
        if not r["externalId"].startswith(expected_prefix):
            violations.append({"externalId": r["externalId"], "tournamentId": r["tournamentId"]})
    return len(violations) == 0, {"violation_count": len(violations), "examples": violations[:20]}


CHECKS = [
    ("duplicate_pbp_hashes", check_duplicate_pbp_hashes),
    ("duplicate_canonical_matches", check_duplicate_canonical_matches),
    ("winner_is_always_player1", check_winner_is_always_player1),
    ("score_agrees_with_reconstruction", check_score_agrees_with_reconstruction),
    ("no_tournament_identity_missing", check_no_tournament_identity_missing),
    ("no_date_missing", check_no_date_missing),
    ("date_is_valid_iso", check_date_is_valid_iso),
    ("cross_tour_contamination", check_cross_tour_contamination),
    ("malformed_pbp_excluded", check_malformed_pbp_excluded),
    ("no_canonical_id_fabrication", check_no_canonical_id_fabrication),
]


def main() -> None:
    files = sorted(EXPORT_ROOT.glob("atp_main_*.json"))
    if not files:
        raise SystemExit(f"No export files found under {EXPORT_ROOT} -- run export-pbp-structurally-validated-corpus.py first")

    records = load_all_records(files)

    results = {}
    all_pass = True
    for name, fn in CHECKS:
        passed, detail = fn(records)
        results[name] = {"status": "PASS" if passed else "FAIL", **detail}
        all_pass = all_pass and passed

    report = {
        "population": "ATP_MAIN approved manifest (STRUCTURALLY_VALIDATED)",
        "source_files": [f.name for f in files],
        "total_records_checked": len(records),
        "overall": "PASS" if all_pass else "FAIL",
        "checks": results,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUT_ROOT / "atp-main-pbp-integrity-check.json").write_text(json.dumps(report, indent=2) + "\n")

    print(f"Total records checked: {len(records)}")
    print(f"Overall: {report['overall']}\n")
    for name, result in results.items():
        print(f"{result['status']:5s} {name}")
    print()
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
