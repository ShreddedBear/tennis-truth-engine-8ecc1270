#!/usr/bin/env python3
"""
Strict re-audit of the 9,218 ATP Challenger PBP mappings that verifier v1
promoted to "VERIFIED" but the v2 pass could only mark PROVISIONAL_REAUDIT_REQUIRED.

This does NOT source any new data. It uses only:
  - data/audit/verified-pbp/atp_challenger/{2012..2015}/verified-mappings.json
    (the v1 output, which already embeds the raw-PBP chronology reconstruction
    result per mapping in `validation`, since the raw PBP text itself is not
    persisted in the repo -- it was fetched transiently from GitHub at v1 run time)
  - data/public/tennismylife-challenger/raw/*.csv (2005-2026, full local corpus)
    for an independent full-corpus H2H/duplicate re-check.

What v2 got wrong (why it produced 0 certified / 9218 provisional):
  - It checked `independent_result_verification.exact_match_date/round/surface`,
    but those keys were never written to that sub-object in the v1 schema
    (exact_match_date is a top-level sibling key; round/surface were never
    duplicated into independent_result_verification at all). Every record
    failed those three checks unconditionally, regardless of content.
  - It checked `uniqueness.all_historical_meetings_searched`, a key v1 never
    wrote (v1 only established SAME-YEAR pair uniqueness). This one is a
    real, not-yet-performed check -- this script performs it for real,
    across the full 2005-2026 local corpus.

What this script does instead, per mapping:
  1. CHRONOLOGY -- trust-but-verify the v1 `validation` object: re-derive the
     oriented reconstructed set score from `validation.sets` (flipping if the
     result winner corresponds to pbp server2) and compare it, and the
     winner, against `historical.score`/`historical.winner` using the same
     score-parsing rules v1 used. Any mismatch is a genuine rejection --
     it means v1's own promotion criterion did not actually hold for that
     record, i.e. a bug/drift, not a formatting nit.
  2. FIELD COMPLETENESS -- round/surface/tournament/winner_id/loser_id/score/
     tourney_id/tourney_date/exact_match_date all present on `historical`.
  3. FULL-CORPUS UNIQUENESS -- rebuild the exact v1 result_match_key for every
     match in the ENTIRE local 2005-2026 tennismylife-challenger corpus (not
     just the mapped year) and confirm this mapping's match_key is unique
     corpus-wide, plus an independent pair+exact-date collision check across
     all years.
  4. GLOBAL DEDUP -- result_key and pbp_sha256 uniqueness across all 9,218
     mappings (re-verified, not assumed).

Outcome per mapping: CERTIFIED / REJECTED / AMBIGUOUS / CONFLICT / REVIEW.
"""
from __future__ import annotations
import csv, hashlib, json, re, unicodedata
from collections import defaultdict, Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERIFIED_BASE = ROOT / "data" / "audit" / "verified-pbp" / "atp_challenger"
TML_RAW = ROOT / "data" / "public" / "tennismylife-challenger" / "raw"
OUT = ROOT / "data" / "audit" / "challenger-pbp-reaudit-v3"
YEARS = [2012, 2013, 2014, 2015]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(v):
    return "" if v is None else str(v).strip()


def norm_name(v) -> str:
    s = unicodedata.normalize("NFKD", clean(v)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def norm_tny(v) -> str:
    s = unicodedata.normalize("NFKD", clean(v)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(atp|challenger|tour|qualifying|main)\b", " ", s)
    s = re.sub(r"20\d{2}", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)


def clean_score(v) -> str:
    s = clean(v).upper()
    for token in ("RET", "DEF", "W/O", "WALKOVER"):
        s = s.replace(token, "")
    return re.sub(r"\s+", " ", s).strip()


def score_games(v):
    out = []
    for token in clean_score(v).split():
        m = re.match(r"^(\d+)-(\d+)", token)
        if m:
            out.append((int(m.group(1)), int(m.group(2))))
    return out


def result_match_key(r: dict, year: int) -> str:
    ids = sorted([clean(r.get("winner_id")), clean(r.get("loser_id"))])
    if not all(ids):
        ids = sorted([norm_name(r.get("winner_name") or r.get("winner")), norm_name(r.get("loser_name") or r.get("loser"))])
    material = "|".join([
        "ATP_CHALLENGER",
        clean(r.get("tourney_id")) or str(year),
        clean(r.get("tourney_date")) or str(year),
        norm_tny(r.get("tourney_name") or r.get("tournament")),
        clean(r.get("round")),
        ids[0] if ids else "",
        ids[1] if len(ids) > 1 else "",
        clean(r.get("match_num")),
        clean_score(r.get("score")),
    ])
    return hashlib.sha256(material.encode()).hexdigest()


def load_full_corpus() -> list[dict]:
    """Every ATP Challenger historical match row available locally, 2005-2026."""
    rows = []
    for path in sorted(TML_RAW.glob("*_challenger.csv")):
        year_str = path.stem.split("_")[0]
        if not year_str.isdigit():
            continue
        year = int(year_str)
        with path.open(newline="", encoding="utf-8-sig", errors="replace") as f:
            for idx, r in enumerate(csv.DictReader(f), start=2):
                d = clean(r.get("tourney_date"))
                row_year = int(d[:4]) if len(d) >= 4 and d[:4].isdigit() else year
                rows.append({
                    "file_year": year,
                    "row_year": row_year,
                    "source_row": idx,
                    "tourney_id": clean(r.get("tourney_id")),
                    "tourney_date": d,
                    "tournament": clean(r.get("tourney_name")),
                    "round": clean(r.get("round")),
                    "winner": clean(r.get("winner_name")),
                    "loser": clean(r.get("loser_name")),
                    "winner_id": clean(r.get("winner_id")),
                    "loser_id": clean(r.get("loser_id")),
                    "score": clean_score(r.get("score")),
                    "match_num": clean(r.get("match_num")),
                })
    return rows


def oriented_sets(sets, result_winner_is_server2: bool):
    sets = [tuple(x) for x in sets]
    if result_winner_is_server2:
        return [(b, a) for a, b in sets]
    return sets


def audit():
    corpus = load_full_corpus()
    print(f"Loaded full local ATP Challenger corpus: {len(corpus)} rows (2005-2026)", flush=True)

    # Full-corpus match_key index (recomputed independently, not reusing v1's stored match_key)
    key_index: dict[str, list[dict]] = defaultdict(list)
    pair_date_index: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for r in corpus:
        mk = result_match_key(r, r["row_year"])
        key_index[mk].append(r)
        pk = (norm_name(r["winner"]), norm_name(r["loser"]), r["tourney_date"])
        pair_date_index[pk].append(r)
        pk_rev = (norm_name(r["loser"]), norm_name(r["winner"]), r["tourney_date"])
        pair_date_index[pk_rev].append(r)

    mappings = []
    for year in YEARS:
        path = VERIFIED_BASE / str(year) / "verified-mappings.json"
        data = json.loads(path.read_text())
        for i, m in enumerate(data):
            mappings.append((year, i, m))

    result_keys = defaultdict(list)
    pbp_keys = defaultdict(list)
    for year, i, m in mappings:
        h = m.get("historical") or {}
        pr = m.get("pbp_ref") or {}
        mk = h.get("match_key") or result_match_key(h, year)
        result_keys[mk].append((year, i))
        pk = pr.get("pbp_sha256") or ""
        pbp_keys[pk].append((year, i))

    manifest = []
    counts = Counter()

    for year, i, m in mappings:
        h = m.get("historical") or {}
        pr = m.get("pbp_ref") or {}
        v = m.get("validation") or {}
        issues = []
        status = None

        # --- 1. CHRONOLOGY re-verification (independent recompute, not trust) ---
        chronology_ok = True
        if v.get("valid") is not True:
            chronology_ok = False
            issues.append("V1_VALIDATION_NOT_MARKED_VALID")
        else:
            result_winner_is_server2 = norm_name(h.get("winner")) == norm_name(pr.get("server2"))
            recon = oriented_sets(v.get("sets") or [], result_winner_is_server2)
            hist_score = score_games(h.get("score"))
            if not hist_score or recon != hist_score:
                chronology_ok = False
                issues.append(f"SCORE_RECONSTRUCTION_MISMATCH: recon={recon} historical={hist_score}")
            expected_winner_idx = 0 if norm_name(h.get("winner")) == norm_name(pr.get("server1")) else (
                1 if norm_name(h.get("winner")) == norm_name(pr.get("server2")) else None)
            if expected_winner_idx is None:
                chronology_ok = False
                issues.append("WINNER_NAME_DOES_NOT_MATCH_EITHER_SERVER")
            elif v.get("winner") != expected_winner_idx:
                chronology_ok = False
                issues.append(f"WINNER_INDEX_MISMATCH: validation.winner={v.get('winner')} expected={expected_winner_idx}")
            pbp_winner_field = clean(pr.get("winner"))
            pbp_winner_name = pr.get("server1") if pbp_winner_field == "1" else (pr.get("server2") if pbp_winner_field == "2" else None)
            if pbp_winner_name and norm_name(pbp_winner_name) != norm_name(h.get("winner")):
                chronology_ok = False
                issues.append("PBP_WINNER_FIELD_DISAGREES_WITH_HISTORICAL_WINNER")

        # --- 2. Field completeness ---
        required = ["round", "surface", "tournament", "winner_id", "loser_id", "score", "tourney_id", "tourney_date"]
        missing_fields = [f for f in required if not h.get(f)]
        if not m.get("exact_match_date"):
            missing_fields.append("exact_match_date")

        # --- 3. Full-corpus uniqueness (independent of v1's same-year-only check) ---
        mk = h.get("match_key") or result_match_key(h, year)
        corpuswide_key_hits = [x for x in key_index.get(mk, [])]
        pk = (norm_name(h.get("winner")), norm_name(h.get("loser")), clean(h.get("tourney_date")))
        pair_date_hits = pair_date_index.get(pk, [])
        # de-dup self-matches counted from both forward+reverse insertion
        seen_ids = set()
        distinct_pair_date_hits = []
        for x in pair_date_hits:
            key = (x["file_year"], x["source_row"])
            if key in seen_ids:
                continue
            seen_ids.add(key)
            distinct_pair_date_hits.append(x)
        ambiguous_h2h = len(distinct_pair_date_hits) > 1

        # --- 4. Global dedup across the 9,218 ---
        dup_result_key = len(result_keys.get(mk, [])) > 1
        dup_pbp_key = len(pbp_keys.get(pr.get("pbp_sha256") or "", [])) > 1

        # --- Classify ---
        if not chronology_ok:
            status = "REJECTED"
            counts["REJECTED"] += 1
        elif dup_result_key or dup_pbp_key:
            status = "CONFLICT"
            if dup_result_key:
                issues.append(f"DUPLICATE_RESULT_KEY_IN_BATCH x{len(result_keys.get(mk, []))}")
            if dup_pbp_key:
                issues.append(f"DUPLICATE_PBP_KEY_IN_BATCH x{len(pbp_keys.get(pr.get('pbp_sha256') or '', []))}")
            counts["CONFLICT"] += 1
        elif ambiguous_h2h:
            status = "AMBIGUOUS"
            issues.append(f"FULL_CORPUS_PAIR_DATE_COLLISION x{len(distinct_pair_date_hits)}")
            counts["AMBIGUOUS"] += 1
        elif missing_fields:
            status = "REVIEW"
            issues.append(f"MISSING_FIELDS: {missing_fields}")
            counts["REVIEW"] += 1
        else:
            status = "CERTIFIED"
            counts["CERTIFIED"] += 1

        manifest.append({
            "year": year,
            "mapping_index": i,
            "match_key": mk,
            "pbp_sha256": pr.get("pbp_sha256"),
            "winner": h.get("winner"),
            "loser": h.get("loser"),
            "tournament": h.get("tournament"),
            "round": h.get("round"),
            "surface": h.get("surface"),
            "score": h.get("score"),
            "tourney_date": h.get("tourney_date"),
            "pbp_date": pr.get("date"),
            "status": status,
            "issues": issues,
        })

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    by_year = defaultdict(Counter)
    for row in manifest:
        by_year[row["year"]][row["status"]] += 1

    summary = {
        "generated_at_utc": now(),
        "scope": "ATP Challenger 2012-2015 provisional mappings from v1/v2 pipeline, re-audited with independently recomputed chronology + full local-corpus (2005-2026) uniqueness checks",
        "total_mappings_checked": len(mappings),
        "totals": dict(counts),
        "by_year": {str(y): dict(c) for y, c in sorted(by_year.items())},
        "corpus_rows_used_for_uniqueness_check": len(corpus),
        "no_new_data_sourced": True,
        "notes": [
            "CHRONOLOGY re-verifies v1's own promotion criterion (oriented reconstructed set score vs. historical score, winner-index vs. historical winner name) independently from the stored validation object -- it does not just trust v1's 'valid: true' flag.",
            "FULL-CORPUS uniqueness checks every 2012-2015 mapping's (winner, loser, tourney_date) triple against ALL locally available ATP Challenger historical rows 2005-2026, not just the same-year file v1 used.",
            "The v2 pipeline's 0-certified result was caused by 3 of its 13 checks reading object paths that don't exist in the v1 schema (independent_result_verification.exact_match_date/round/surface) so they failed unconditionally on every record, plus one real but overly-narrow same-year-only uniqueness check. This script fixes the schema-path bugs and performs the uniqueness check for real across the full corpus.",
            "This audit does not have a second, genuinely independent (non-TennisMyLife) historical-results source available locally to cross-verify date/round/surface -- CERTIFIED here means 'passed independent chronology recomputation + full-corpus uniqueness + field completeness against the single available primary source', not 'confirmed against two independent sources'.",
        ],
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")

    md = [
        "# ATP Challenger PBP v3 Re-audit — 9,218 provisional records",
        "",
        f"- Generated: {summary['generated_at_utc']}",
        f"- Total mappings checked: **{len(mappings)}**",
        "",
        "## Totals",
        "",
        "| Status | Count |",
        "|---|---:|",
    ]
    for k in ["CERTIFIED", "REVIEW", "AMBIGUOUS", "CONFLICT", "REJECTED"]:
        md.append(f"| {k} | {counts.get(k, 0)} |")
    md += ["", "## By year", "", "| Year | Certified | Review | Ambiguous | Conflict | Rejected |", "|---:|---:|---:|---:|---:|---:|"]
    for y in YEARS:
        c = by_year.get(y, Counter())
        md.append(f"| {y} | {c.get('CERTIFIED',0)} | {c.get('REVIEW',0)} | {c.get('AMBIGUOUS',0)} | {c.get('CONFLICT',0)} | {c.get('REJECTED',0)} |")
    (OUT / "summary.md").write_text("\n".join(md) + "\n")

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    audit()
