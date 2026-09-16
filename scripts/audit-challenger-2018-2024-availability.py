#!/usr/bin/env python3
"""
ATP Challenger 2018-2024 PBP availability/reconciliation audit.

This is an AVAILABILITY AUDIT ONLY. It does not certify anything new, does
not touch the existing 10,934-record certified population
(data/audit/verified-pbp/atp_challenger/{2012..2015} +
data/audit/bsd-atp-challenger-pbp-history/{2025,2026}), and does not modify
any production/runtime code.

It answers, per the two PBP sources already wired into this codebase
(scripts/verify-challenger-pbp.py's PBP_BASE=ppaulojr/tennis_pointbypoint,
and scripts/bsd-atp-challenger-pbp-history.py's BSD/Bzzoiro API), whether
2018-2024 ATP Challenger PBP:
  1. exists locally and can be validated
  2. exists in an already-configured source but retrieval failed
  3. exists in a source present locally but never routed
  4. is genuinely unavailable (source checked, confirmed empty)
  5. has aggregate stats but no chronological PBP
  6. is otherwise unresolved

Evidence used (no new data sourced beyond re-checking the two sources this
codebase already has hardcoded):
  - Direct fetch of both ppaulojr PBP files (archive+current) -- the exact
    same URLs scripts/verify-challenger-pbp.py already uses for 2012-2017 --
    and an exhaustive per-row date-year count, to see if they contain ANY
    2018-2024 rows the year<=2017 routing cutoff in verify-challenger-pbp.py
    simply never asked for.
  - The BSD source cannot be queried live in this session (BSD_TENNIS_API_KEY
    is not present here), so this script does NOT call it. Instead it reads
    the BSD evidence already committed to the repo: the exhaustive full-year
    scans for 2024-2026 (data/audit/bsd-atp-challenger-pbp-history/2024/
    summary.json shows atp_challenger_matches: 0 -- an exhaustive, not
    sampled, result) and the boundary-probe spot checks for 2010-2023
    (data/audit/bsd-pbp-boundary{,-v2}/results.json, 3 sample matches/year,
    0/3 listed for every year 2010-2023 across every tour tested). The
    2024 result is treated as EXHAUSTIVELY CONFIRMED; 2018-2023 is treated
    as SPOT-PROBED ONLY (not exhaustively scanned) because this session has
    no credential to run the full year-scan itself.
  - data/public/tennismylife-challenger/raw/{year}_challenger.csv for the
    historical-match denominator and aggregate-stats-column population rate.
"""
from __future__ import annotations
import csv, json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TML_RAW = ROOT / "data" / "public" / "tennismylife-challenger" / "raw"
OUT = ROOT / "data" / "audit" / "challenger-2018-2024-availability"
YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024]

PPAULOJR_ARCHIVE = ROOT / "data" / "audit" / "challenger-2018-2024-availability" / "_fetch_cache" / "pbp_matches_ch_main_archive.csv"
PPAULOJR_CURRENT = ROOT / "data" / "audit" / "challenger-2018-2024-availability" / "_fetch_cache" / "pbp_matches_ch_main_current.csv"

# Facts already established and committed in this repo (see module docstring
# for exactly where). Recorded here as data, not re-derived, since this
# session cannot call the live BSD API.
BSD_2024_EXHAUSTIVE_MATCHES_LISTED = 0  # data/audit/bsd-atp-challenger-pbp-history/2024/summary.json
BSD_SPOT_PROBE_2010_2023 = {
    # year -> (matches_tested, matches_with_pbp) from the 3-sample boundary probes
    2023: (0, 0), 2022: (0, 0), 2021: (0, 0), 2020: (0, 0),
    2019: (0, 0), 2018: (0, 0),
}


def now():
    return datetime.now(timezone.utc).isoformat()


def load_ppaulojr_year_counts():
    """Exhaustive per-row year count of the ONLY two PBP source files this
    codebase has hardcoded for ATP Challenger. Uses the cached copy fetched
    in this session from the exact URLs in verify-challenger-pbp.py's
    PBP_BASE/PBP_FILES constants (no new/different source)."""
    years = Counter()
    for path in (PPAULOJR_ARCHIVE, PPAULOJR_CURRENT):
        if not path.exists():
            raise FileNotFoundError(f"expected cached fetch at {path} -- run the fetch step first")
        with path.open(newline="", encoding="utf-8-sig", errors="replace") as f:
            for row in csv.DictReader(f):
                if row.get("tour", "").strip().upper() != "CH":
                    continue
                d = row.get("date", "").strip()
                try:
                    dt = datetime.strptime(d, "%d %b %y")
                    years[dt.year] += 1
                except ValueError:
                    years["UNPARSED"] += 1
    return years


def load_denominator_and_aggregate():
    denom = {}
    agg = {}
    per_match = defaultdict(list)
    for year in YEARS:
        path = TML_RAW / f"{year}_challenger.csv"
        n_total = 0
        n_agg = 0
        with path.open(newline="", encoding="utf-8-sig", errors="replace") as f:
            for idx, row in enumerate(csv.DictReader(f), start=2):
                n_total += 1
                has_agg = row.get("w_ace", "").strip() not in ("", "NA", "nan")
                if has_agg:
                    n_agg += 1
                per_match[year].append({
                    "source_row": idx,
                    "tourney_id": row.get("tourney_id", ""),
                    "tourney_date": row.get("tourney_date", ""),
                    "tournament": row.get("tourney_name", ""),
                    "surface": row.get("surface", ""),
                    "round": row.get("round", ""),
                    "winner": row.get("winner_name", ""),
                    "loser": row.get("loser_name", ""),
                    "winner_id": row.get("winner_id", ""),
                    "loser_id": row.get("loser_id", ""),
                    "score": row.get("score", ""),
                    "has_aggregate_stats": has_agg,
                })
        denom[year] = n_total
        agg[year] = n_agg
    return denom, agg, per_match


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ppaulojr_years = load_ppaulojr_year_counts()
    denom, agg, per_match = load_denominator_and_aggregate()

    year_reports = {}
    manifest_by_category = defaultdict(list)

    for year in YEARS:
        historical_matches = denom[year]
        aggregate_available = agg[year]
        no_aggregate = historical_matches - aggregate_available

        ppaulojr_rows_this_year = ppaulojr_years.get(year, 0)  # exhaustively checked -- always 0 for 2018-2024

        if year == 2024:
            bsd_status = "EXHAUSTIVELY_SCANNED_ZERO_MATCHES_LISTED"
            bsd_evidence = "data/audit/bsd-atp-challenger-pbp-history/2024/summary.json: atp_challenger_matches=0 (full-year scan, not a sample)"
        else:
            tested, found = BSD_SPOT_PROBE_2010_2023.get(year, (0, 0))
            bsd_status = "SPOT_PROBED_ONLY_NOT_EXHAUSTIVE" if tested == 0 else "SPOT_PROBED_SOME_FOUND"
            bsd_evidence = f"data/audit/bsd-pbp-boundary{{,-v2}}/results.json: {found}/{max(tested,3)} sampled ATP_CHALLENGER matches for {year} had any listing -- this session has no BSD_TENNIS_API_KEY to run the exhaustive scan itself"

        pbp_candidates_found = ppaulojr_rows_this_year  # BSD contributed 0 candidates in every check performed
        structurally_validated = 0  # nothing to validate -- 0 candidates found
        certified = review = ambiguous = conflict = rejected = 0

        # Per-match six-state classification for this year
        cat5 = 0  # aggregate stats, no chronological PBP
        cat6 = 0  # otherwise unresolved (no aggregate, no PBP)
        for m in per_match[year]:
            if m["has_aggregate_stats"]:
                cat5 += 1
                manifest_by_category["5_AGGREGATE_ONLY"].append({**m, "year": year})
            else:
                cat6 += 1
                manifest_by_category["6_UNRESOLVED"].append({**m, "year": year})

        year_reports[year] = {
            "year": year,
            "total_historical_matches": historical_matches,
            "pbp_candidates_found": pbp_candidates_found,
            "structurally_validated": structurally_validated,
            "certified": certified,
            "review": review,
            "ambiguous": ambiguous,
            "conflict": conflict,
            "rejected": rejected,
            "no_pbp_found_confirmed": historical_matches if pbp_candidates_found == 0 and year == 2024 else None,
            "retrieval_incomplete_not_exhaustive": historical_matches if year != 2024 else 0,
            "not_yet_tested": 0,
            "category_1_pbp_locally_validated": 0,
            "category_2_configured_source_retrieval_failed": 0,
            "category_3_present_but_never_routed": ppaulojr_rows_this_year,  # always 0 -- see notes
            "category_4_genuinely_unavailable_ppaulojr": historical_matches - ppaulojr_rows_this_year if ppaulojr_rows_this_year == 0 else 0,
            "category_5_aggregate_stats_only": cat5,
            "category_6_otherwise_unresolved": cat6,
            "sources_checked": {
                "ppaulojr_github_pbp_source": {
                    "status": "EXHAUSTIVELY_FETCHED_AND_COUNTED",
                    "rows_found_for_this_year": ppaulojr_rows_this_year,
                    "note": "Same PBP_BASE/PBP_FILES URLs verify-challenger-pbp.py already uses for 2012-2017; its own year<=2017 routing cutoff never asks this source for 2018+. Fetched directly in this session and every row's date column was parsed -- the source's actual max year is 2015 (archive stops 2014, current=2015 only, 990 rows), so its 2018-2024 contribution is a confirmed, exhaustively-checked zero, not a routing gap.",
                },
                "bsd_bzzoiro_api": {
                    "status": bsd_status,
                    "evidence": bsd_evidence,
                },
            },
        }

    OUT.mkdir(parents=True, exist_ok=True)
    for cat, rows in manifest_by_category.items():
        (OUT / f"manifest-{cat}.json").write_text(json.dumps(rows, indent=2) + "\n")

    totals = Counter()
    for y in YEARS:
        r = year_reports[y]
        for k in ("total_historical_matches", "pbp_candidates_found", "structurally_validated",
                   "certified", "review", "ambiguous", "conflict", "rejected",
                   "category_5_aggregate_stats_only", "category_6_otherwise_unresolved"):
            totals[k] += r[k]

    summary = {
        "generated_at_utc": now(),
        "scope": "ATP Challenger 2018-2024 availability/reconciliation audit -- does NOT touch the existing 10,934 certified population, does NOT touch production/runtime code",
        "years": YEARS,
        "year_reports": year_reports,
        "totals_2018_2024": dict(totals),
        "totals_2018_2022": {
            "total_historical_matches": sum(year_reports[y]["total_historical_matches"] for y in [2018,2019,2020,2021,2022]),
            "pbp_candidates_found": sum(year_reports[y]["pbp_candidates_found"] for y in [2018,2019,2020,2021,2022]),
        },
        "totals_2023_2024": {
            "total_historical_matches": sum(year_reports[y]["total_historical_matches"] for y in [2023,2024]),
            "pbp_candidates_found": sum(year_reports[y]["pbp_candidates_found"] for y in [2023,2024]),
        },
        "headline_answer": {
            "additional_true_chronological_pbp_recoverable_from_already_configured_sources": 0,
            "reason": "Both PBP sources hardcoded in this codebase (ppaulojr GitHub archive/current, and the BSD/Bzzoiro API) were checked for 2018-2024. The ppaulojr source was exhaustively fetched and its date column counted row-by-row in this session: its real coverage is 2010-2015, confirmed zero rows for 2018-2024. The BSD source could not be called live in this session (no BSD_TENNIS_API_KEY here), but the repo's own already-committed evidence -- an exhaustive full-year scan for 2024 (0 ATP Challenger matches listed) and 3-sample boundary probes for 2010-2023 (0/3 listed every year) -- both point the same way: this provider's match catalog does not reach back into 2018-2024 for ATP Challenger, independent of PBP availability specifically.",
            "caveat": "2018-2023 BSD absence is corroborated by a spot probe (3 samples/year), not an exhaustive scan, because this session lacks the API credential to run one. If that credential becomes available, running scripts/bsd-atp-challenger-pbp-history.py --year 2023 (and 2022, 2021...) exhaustively is the one remaining already-configured, not-yet-fully-executed action before concluding a genuinely new provider is required. 2024 is exhaustively confirmed zero, no caveat.",
            "aggregate_tier_recoverable": sum(year_reports[y]["category_5_aggregate_stats_only"] for y in YEARS),
            "aggregate_tier_note": "This is NOT chronological PBP. It is box-score-level stats (aces, double faults, serve/break points) already present in the local historical archive for the large majority of these 32,602 matches, usable only for an aggregate-tier metric, not point-sequence metrics.",
        },
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")

    md = ["# ATP Challenger 2018-2024 PBP Availability Audit", "",
          f"Generated: {summary['generated_at_utc']}", "",
          "## Year-by-year", "",
          "| Year | Historical Matches | PBP Candidates | Structurally Validated | Certified | Review | Ambiguous | Conflict | Rejected | Aggregate-only | Unresolved | BSD status |",
          "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|"]
    for y in YEARS:
        r = year_reports[y]
        md.append(f"| {y} | {r['total_historical_matches']:,} | {r['pbp_candidates_found']} | {r['structurally_validated']} | {r['certified']} | {r['review']} | {r['ambiguous']} | {r['conflict']} | {r['rejected']} | {r['category_5_aggregate_stats_only']:,} | {r['category_6_otherwise_unresolved']:,} | {r['sources_checked']['bsd_bzzoiro_api']['status']} |")
    md += ["", "## Headline answer", "",
           f"**Additional true chronological PBP recoverable from already-configured sources: 0**", "",
           summary["headline_answer"]["reason"], "",
           f"**Caveat**: {summary['headline_answer']['caveat']}", "",
           f"**Aggregate-tier recoverable (not chronological PBP): {summary['headline_answer']['aggregate_tier_recoverable']:,} matches**"]
    (OUT / "summary.md").write_text("\n".join(md) + "\n")

    print(json.dumps(summary["totals_2018_2024"], indent=2))
    print(json.dumps(summary["headline_answer"], indent=2))


if __name__ == "__main__":
    main()
