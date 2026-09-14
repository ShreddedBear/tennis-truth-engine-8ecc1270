#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "audit" / "verified-pbp" / "atp_challenger"
TML_ROOT = ROOT / "data" / "public" / "tennismylife-challenger"
TML_RAW = TML_ROOT / "raw"

PBP_BASE = "https://raw.githubusercontent.com/ppaulojr/tennis_pointbypoint/master"
PBP_FILES = ["pbp_matches_ch_main_archive.csv", "pbp_matches_ch_main_current.csv"]
TML_API = "https://stats.tennismylife.org/api/data-files"
UA = "tennis-truth-engine-challenger-pbp-firewall/1.0"
VERIFIER_VERSION = 1
HARD_EXCLUDED = set(range(2018, 2023))


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_bytes(url: str, bearer: str = "") -> bytes:
    headers = {"User-Agent": UA}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read()


def get_text(url: str, bearer: str = "") -> str:
    return get_bytes(url, bearer).decode("utf-8-sig", "replace")


def clean(v: Any) -> str:
    return "" if v is None else str(v).strip()


def norm_name(v: Any) -> str:
    s = unicodedata.normalize("NFKD", clean(v)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def norm_tny(v: Any) -> str:
    s = unicodedata.normalize("NFKD", clean(v)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(atp|challenger|tour|qualifying|main)\b", " ", s)
    s = re.sub(r"20\d{2}", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)


def tny_ok(a: Any, b: Any) -> bool:
    x, y = norm_tny(a), norm_tny(b)
    if not x or not y:
        return False
    return x == y or x in y or y in x


def parse_date(v: Any) -> str:
    s = clean(v)
    if not s:
        return ""
    for fmt in ("%d %b %y", "%Y-%m-%d", "%Y%m%d", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return ""


def clean_score(v: Any) -> str:
    s = clean(v).upper()
    for token in ("RET", "DEF", "W/O", "WALKOVER"):
        s = s.replace(token, "")
    return re.sub(r"\s+", " ", s).strip()


def score_games(v: Any) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for token in clean_score(v).split():
        m = re.match(r"^(\d+)-(\d+)", token)
        if m:
            out.append((int(m.group(1)), int(m.group(2))))
    return out


def pair_key(a: Any, b: Any) -> tuple[str, str]:
    return tuple(sorted((norm_name(a), norm_name(b))))


def game_winner(seq: str, server: int, tb: bool = False) -> int | None:
    cur = server
    points = [0, 0]
    ended = False
    for ch in seq:
        if ch == "/":
            if not tb:
                return None
            cur = 1 - cur
            continue
        if ch not in "SRAD":
            return None
        w = cur if ch in "SA" else 1 - cur
        points[w] += 1
        terminal = (max(points) >= 7 and abs(points[0] - points[1]) >= 2) if tb else (max(points) >= 4 and abs(points[0] - points[1]) >= 2)
        if ended:
            return None
        if terminal:
            ended = True
    if not ended:
        return None
    return 0 if points[0] > points[1] else 1


def reconstruct(pbp: str) -> dict[str, Any]:
    if not pbp:
        return {"valid": False, "reason": "EMPTY_PBP"}
    server = 0
    sets: list[list[int]] = []
    point_count = 0
    for set_blob in pbp.strip().split("."):
        if not set_blob:
            return {"valid": False, "reason": "EMPTY_SET"}
        wins = [0, 0]
        games = [g for g in set_blob.split(";") if g != ""]
        if not games:
            return {"valid": False, "reason": "EMPTY_SET_GAMES"}
        for game in games:
            winner = game_winner(game, server, "/" in game)
            if winner is None:
                return {"valid": False, "reason": "ILLEGAL_GAME", "game": game}
            wins[winner] += 1
            point_count += sum(c in "SRAD" for c in game)
            server = 1 - server
        a, b = wins
        if not ((max(a, b) >= 6 and abs(a - b) >= 2) or (a, b) in ((7, 6), (6, 7))):
            return {"valid": False, "reason": "ILLEGAL_SET", "sets": sets + [wins]}
        sets.append(wins)
    set_wins = [sum(a > b for a, b in sets), sum(b > a for a, b in sets)]
    if set_wins[0] == set_wins[1]:
        return {"valid": False, "reason": "NO_MATCH_WINNER", "sets": sets}
    return {
        "valid": True,
        "sets": sets,
        "winner": 0 if set_wins[0] > set_wins[1] else 1,
        "points": point_count,
        "games": sum(sum(x) for x in sets),
    }


def tml_file_for_year(year: int) -> tuple[bytes, str]:
    TML_RAW.mkdir(parents=True, exist_ok=True)
    local_candidates = sorted(TML_RAW.glob(f"*{year}*challenger*.csv"))
    if local_candidates:
        return local_candidates[0].read_bytes(), f"local:{local_candidates[0].relative_to(ROOT)}"

    meta = json.loads(get_text(TML_API))
    files = meta.get("files", []) if isinstance(meta, dict) else []
    exact_name = f"{year}_challenger.csv".lower()
    candidates = [x for x in files if clean(x.get("name")).lower() == exact_name]
    if not candidates:
        candidates = [x for x in files if str(year) in clean(x.get("name")).lower() and "challenger" in clean(x.get("name")).lower() and clean(x.get("name")).lower().endswith(".csv")]
    if len(candidates) != 1:
        raise RuntimeError(f"TennisMyLife result file unresolved for {year}: candidates={len(candidates)}")
    url = clean(candidates[0].get("url"))
    if not url:
        raise RuntimeError(f"TennisMyLife result URL missing for {year}")
    data = get_bytes(url)
    name = clean(candidates[0].get("name")) or f"{year}_challenger.csv"
    (TML_RAW / name).write_bytes(data)
    return data, url


def result_match_key(r: dict[str, str], year: int) -> str:
    ids = sorted([clean(r.get("winner_id")), clean(r.get("loser_id"))])
    if not all(ids):
        ids = sorted([norm_name(r.get("winner_name")), norm_name(r.get("loser_name"))])
    material = "|".join([
        "ATP_CHALLENGER",
        clean(r.get("tourney_id")) or str(year),
        clean(r.get("tourney_date")) or str(year),
        norm_tny(r.get("tourney_name")),
        clean(r.get("round")),
        ids[0] if ids else "",
        ids[1] if len(ids) > 1 else "",
        clean(r.get("match_num")),
        clean_score(r.get("score")),
    ])
    return hashlib.sha256(material.encode()).hexdigest()


def load_results(year: int) -> tuple[list[dict[str, Any]], str]:
    data, source = tml_file_for_year(year)
    rows = list(csv.DictReader(io.StringIO(data.decode("utf-8-sig", "replace"))))
    out: list[dict[str, Any]] = []
    seen: dict[str, dict[str, Any]] = {}
    for idx, r in enumerate(rows, start=2):
        d = clean(r.get("tourney_date"))
        row_year = int(d[:4]) if len(d) >= 4 and d[:4].isdigit() else year
        if row_year != year:
            continue
        winner = clean(r.get("winner_name"))
        loser = clean(r.get("loser_name"))
        if not winner or not loser:
            continue
        mk = result_match_key(r, year)
        rec = {
            "source": "TennisMyLife",
            "source_row": idx,
            "match_key": mk,
            "year": year,
            "tourney_id": clean(r.get("tourney_id")),
            "tourney_date": clean(r.get("tourney_date")),
            "tournament": clean(r.get("tourney_name")),
            "surface": clean(r.get("surface")),
            "round": clean(r.get("round")),
            "winner": winner,
            "loser": loser,
            "winner_id": clean(r.get("winner_id")),
            "loser_id": clean(r.get("loser_id")),
            "score": clean_score(r.get("score")),
            "match_num": clean(r.get("match_num")),
            "dedup_status": "NEW_MATCH",
        }
        if mk in seen:
            rec["dedup_status"] = "EXACT_DUPLICATE" if seen[mk]["winner"] == winner and seen[mk]["score"] == rec["score"] else "CONFLICTING_DUPLICATE"
        else:
            seen[mk] = rec
        out.append(rec)
    return out, source


def modern_local_pbp_candidates(year: int) -> list[Path]:
    return [
        ROOT / "data" / "raw" / "pbp" / "challenger" / f"{year}.csv",
        ROOT / "data" / "raw" / "pbp" / f"atp_challenger_{year}.csv",
        ROOT / "data" / "public" / "pbp" / "challenger" / f"{year}.csv",
    ]


def load_pbp(year: int) -> tuple[list[dict[str, Any]], list[str]]:
    sources: list[tuple[str, str]] = []
    if year <= 2017:
        for fn in PBP_FILES:
            sources.append((f"{PBP_BASE}/{fn}", fn))
    else:
        for path in modern_local_pbp_candidates(year):
            if path.exists():
                sources.append((path.read_text(encoding="utf-8-sig", errors="replace"), f"local:{path.relative_to(ROOT)}"))
                break
        if not sources:
            template = clean(os.environ.get("CHALLENGER_PBP_URL_TEMPLATE"))
            if template:
                url = template.format(year=year)
                bearer = clean(os.environ.get("CHALLENGER_PBP_BEARER_TOKEN"))
                sources.append((get_text(url, bearer), url))

    if not sources:
        raise FileNotFoundError("NO_MODERN_CHALLENGER_PBP_SOURCE_CONFIGURED")

    out: list[dict[str, Any]] = []
    used_sources: list[str] = []
    for source, label in sources:
        text = source if label.startswith("local:") else get_text(source)
        used_sources.append(label)
        for idx, r in enumerate(csv.DictReader(io.StringIO(text)), start=2):
            d = parse_date(r.get("date"))
            if not d or int(d[:4]) != year:
                continue
            tour = clean(r.get("tour")).upper()
            draw = clean(r.get("draw")).lower()
            if tour not in {"CH", "CHALLENGER", "ATP_CHALLENGER"} or draw not in {"main", "m", "main draw"}:
                continue
            p1, p2 = clean(r.get("server1")), clean(r.get("server2"))
            raw = clean(r.get("pbp"))
            if not p1 or not p2 or not raw:
                continue
            out.append({
                "source_file": label,
                "source_row": idx,
                "date": d,
                "tournament": clean(r.get("tny_name") or r.get("tournament")),
                "server1": p1,
                "server2": p2,
                "winner": clean(r.get("winner")),
                "score": clean_score(r.get("score")),
                "pbp": raw,
                "pbp_sha256": hashlib.sha256(raw.encode()).hexdigest(),
            })
    return out, used_sources


def pbp_winner_name(p: dict[str, Any]) -> str:
    if str(p.get("winner")) == "1":
        return p["server1"]
    if str(p.get("winner")) == "2":
        return p["server2"]
    return ""


def oriented_reconstructed_score(rec: dict[str, Any], p: dict[str, Any], result_winner: str) -> list[tuple[int, int]]:
    sets = [tuple(x) for x in rec.get("sets", [])]
    if norm_name(result_winner) == norm_name(p["server2"]):
        return [(b, a) for a, b in sets]
    return sets


def run(year: int) -> int:
    target = OUT / str(year)
    target.mkdir(parents=True, exist_ok=True)

    if year in HARD_EXCLUDED:
        summary = {
            "verifier_version": VERIFIER_VERSION,
            "tour": "ATP_CHALLENGER",
            "year": year,
            "batch_status": "HARD_EXCLUDED",
            "source_blocked": False,
            "verified": 0,
            "partial": 0,
            "ambiguous": 0,
            "conflicts": 0,
            "no_pbp": 0,
            "retrieval_failures": 0,
            "generated_at_utc": now(),
        }
        (target / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        return 0

    try:
        results, result_source = load_results(year)
    except Exception as exc:
        summary = {
            "verifier_version": VERIFIER_VERSION,
            "tour": "ATP_CHALLENGER",
            "year": year,
            "batch_status": "BLOCKED",
            "source_blocked": True,
            "block_reason": f"RESULT_SOURCE:{type(exc).__name__}:{exc}",
            "verified": 0,
            "partial": 0,
            "ambiguous": 0,
            "conflicts": 0,
            "no_pbp": 0,
            "retrieval_failures": 1,
            "generated_at_utc": now(),
        }
        (target / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        print("BATCH_BLOCKED " + json.dumps(summary, separators=(",", ":")))
        return 75

    try:
        pbps, pbp_sources = load_pbp(year)
    except Exception as exc:
        summary = {
            "verifier_version": VERIFIER_VERSION,
            "tour": "ATP_CHALLENGER",
            "year": year,
            "batch_status": "BLOCKED",
            "source_blocked": True,
            "block_reason": f"PBP_SOURCE:{type(exc).__name__}:{exc}",
            "historical_matches": len(results),
            "pbp_candidates": 0,
            "verified": 0,
            "partial": 0,
            "ambiguous": 0,
            "conflicts": 0,
            "no_pbp": len(results),
            "retrieval_failures": 1,
            "result_source": result_source,
            "generated_at_utc": now(),
        }
        (target / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        print("BATCH_BLOCKED " + json.dumps(summary, separators=(",", ":")))
        return 75

    by_pair: dict[tuple[str, str], list[int]] = defaultdict(list)
    for i, r in enumerate(results):
        if r["dedup_status"] == "NEW_MATCH":
            by_pair[pair_key(r["winner"], r["loser"])].append(i)

    candidate_results: dict[int, list[int]] = defaultdict(list)
    structural: dict[int, dict[str, Any]] = {}
    pre_rejects: dict[int, str] = {}

    for pi, p in enumerate(pbps):
        rec = reconstruct(p["pbp"])
        structural[pi] = rec
        if not rec.get("valid"):
            pre_rejects[pi] = "PBP_STRUCTURAL_INVALID"
            continue
        pwin = pbp_winner_name(p)
        if not pwin:
            pre_rejects[pi] = "PBP_WINNER_MISSING"
            continue
        for ri in by_pair.get(pair_key(p["server1"], p["server2"]), []):
            r = results[ri]
            if norm_name(pwin) != norm_name(r["winner"]):
                continue
            if not tny_ok(p["tournament"], r["tournament"]):
                continue
            reconstructed = oriented_reconstructed_score(rec, p, r["winner"])
            rscore = score_games(r["score"])
            if not rscore or reconstructed != rscore:
                continue
            expected_winner_index = 0 if norm_name(r["winner"]) == norm_name(p["server1"]) else 1
            if rec["winner"] != expected_winner_index:
                continue
            candidate_results[pi].append(ri)

    result_to_pbp: dict[int, list[int]] = defaultdict(list)
    for pi, ris in candidate_results.items():
        for ri in ris:
            result_to_pbp[ri].append(pi)

    counts = Counter()
    used_result_keys: set[str] = set()
    used_pbp_hashes: set[str] = set()
    verified: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []

    for ri, r in enumerate(results):
        if r["dedup_status"] != "NEW_MATCH":
            counts["PBP_CONFLICT"] += 1
            records.append({"result": r, "status": "PBP_CONFLICT", "reason": r["dedup_status"]})
            continue
        pis = result_to_pbp.get(ri, [])
        if not pis:
            counts["NO_PBP_AVAILABLE"] += 1
            records.append({"result": r, "status": "NO_PBP_AVAILABLE"})
            continue
        if len(pis) != 1:
            counts["AMBIGUOUS_MATCH"] += 1
            records.append({"result": r, "status": "AMBIGUOUS_MATCH", "candidate_count": len(pis)})
            continue
        pi = pis[0]
        p = pbps[pi]
        # Forward and reverse uniqueness are both mandatory.
        if len(candidate_results.get(pi, [])) != 1:
            counts["AMBIGUOUS_MATCH"] += 1
            records.append({"result": r, "status": "AMBIGUOUS_MATCH", "reverse_candidate_count": len(candidate_results.get(pi, []))})
            continue
        if r["match_key"] in used_result_keys or p["pbp_sha256"] in used_pbp_hashes:
            counts["PBP_CONFLICT"] += 1
            records.append({"result": r, "status": "PBP_CONFLICT", "reason": "DUPLICATE_PROTECTION"})
            continue

        used_result_keys.add(r["match_key"])
        used_pbp_hashes.add(p["pbp_sha256"])
        rec = structural[pi]
        mapping = {
            "tour": "ATP_CHALLENGER",
            "year": year,
            "historical": r,
            "exact_match_date": p["date"],
            "independent_result_verification": {
                "source": "TennisMyLife",
                "source_reference": result_source,
                "tournament_start_date": r["tourney_date"],
                "winner": r["winner"],
                "loser": r["loser"],
                "score": r["score"],
            },
            "pbp_ref": {k: p[k] for k in ("source_file", "source_row", "date", "tournament", "server1", "server2", "winner", "score", "pbp_sha256")},
            "validation": rec,
            "uniqueness": {
                "same_year_pair_result_rows": len(by_pair[pair_key(r["winner"], r["loser"])]),
                "forward_candidates": 1,
                "reverse_candidates": 1,
                "result_match_key_unique_in_batch": True,
                "pbp_sha256_unique_in_batch": True,
            },
            "trust_level": "STRICT_RESULT_VERIFIED_PBP",
            "verifier_version": VERIFIER_VERSION,
        }
        verified.append(mapping)
        counts["RESULT_VERIFIED_PBP"] += 1
        records.append({"result": r, "status": "RESULT_VERIFIED_PBP", "pbp_ref": mapping["pbp_ref"], "trust_level": mapping["trust_level"]})

    orphan_pbp = []
    for pi, p in enumerate(pbps):
        if p["pbp_sha256"] in used_pbp_hashes:
            continue
        if pi in pre_rejects:
            status, reason = "PBP_UNUSABLE", pre_rejects[pi]
        elif not candidate_results.get(pi):
            status, reason = "NO_MATCH", "NO_RESULT_CANDIDATE_PASSED_FIREWALL"
        elif len(candidate_results[pi]) > 1:
            status, reason = "AMBIGUOUS_MATCH", "MULTIPLE_RESULT_CANDIDATES"
        else:
            status, reason = "REVIEW_REQUIRED", "NOT_PROMOTED"
        orphan_pbp.append({
            "pbp_ref": {k: p[k] for k in ("source_file", "source_row", "date", "tournament", "server1", "server2", "winner", "score", "pbp_sha256")},
            "status": status,
            "reason": reason,
        })

    summary = {
        "verifier_version": VERIFIER_VERSION,
        "tour": "ATP_CHALLENGER",
        "year": year,
        "batch_status": "PROCESSED",
        "source_blocked": False,
        "historical_matches": len(results),
        "pbp_candidates": len(pbps),
        "verified": counts["RESULT_VERIFIED_PBP"],
        "partial": counts["REVIEW_REQUIRED"],
        "ambiguous": counts["AMBIGUOUS_MATCH"],
        "conflicts": counts["PBP_CONFLICT"] + counts["PBP_UNUSABLE"],
        "no_pbp": counts["NO_PBP_AVAILABLE"],
        "retrieval_failures": 0,
        "orphan_pbp": len(orphan_pbp),
        "result_source": result_source,
        "pbp_sources": pbp_sources,
        "firewall": [
            "structural_reconstruction",
            "player_pair_identity",
            "winner_identity",
            "tournament_identity",
            "reconstructed_score_match",
            "reconstructed_winner_match",
            "forward_uniqueness",
            "reverse_uniqueness",
            "result_match_key_dedup",
            "pbp_sha256_dedup",
            "global_cross_year_collision_audit_by_queue_manager",
        ],
        "generated_at_utc": now(),
    }

    for filename, obj in (
        ("summary.json", summary),
        ("verified-mappings.json", verified),
        ("records.json", records),
        ("orphan-pbp.json", orphan_pbp),
    ):
        (target / filename).write_text(json.dumps(obj, indent=2) + "\n")

    print("BATCH_RESULT " + json.dumps(summary, separators=(",", ":")), flush=True)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    args = ap.parse_args()
    return run(args.year)


if __name__ == "__main__":
    raise SystemExit(main())
