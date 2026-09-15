#!/usr/bin/env python3
"""Merge the two verified WTA Main PBP sources (non-Slam 2011-2015 via
ppaulojr/tennis_pointbypoint, cross-verified against local Tennis-Data.co.uk;
Grand Slam 2016-2024 via the Aneeshers Sackmann slam_pointbypoint mirror,
single-source structurally validated) into one JSONL evidence index that
src/lib/sackmann-wta-main-pbp.server.ts consumes.

Each output row's "games" field is already shaped for direct input to
reconstructPbpScoreState() (src/lib/pbp-score-state-recovery.ts): a flat
list of {server:"player1"|"player2", points:[{winner,ace,double_fault}]}
game objects, oriented so "player1"/"player2" consistently mean
player1_name/player2_name on that same row.

Never merges the two sources for the same match: the slam script is
restricted to years 2016+ (ppaulojr's coverage ends 2015), so there is no
overlap window to de-duplicate against.
"""
import glob
import hashlib
import json
from pathlib import Path

OUT_DIR = Path("data/metrics/pbp/wta_main")
OUT_PATH = OUT_DIR / "approved-index.jsonl"


def slot_name(slot, a, b):
    return a if slot == 0 else b


def convert_nonslam(mapping):
    h = mapping["historical"]
    p = mapping["pbp_ref"]
    player1, player2 = p["server1"], p["server2"]
    games = []
    for set_games in mapping["reconstructed_games"]:
        for g in set_games:
            games.append({
                "server": slot_name(g["server"], "player1", "player2"),
                "tiebreak": g["tiebreak"],
                "points": [{"winner": slot_name(pt["winner"], "player1", "player2"), "ace": pt.get("ace"), "double_fault": pt.get("df")} for pt in g["points"]],
            })
    return {
        "tour": "WTA_MAIN", "year": mapping["year"], "player1": player1, "player2": player2,
        "tournament": h["tournament"], "date": p["date"], "round": h["round"], "surface": h["surface"],
        "event_level": h["level"], "best_of": h["best_of"],
        "source": "SACKMANN_ARCHIVE_PPAULOJR", "trust_level": mapping["trust_level"],
        "independent_verification_source": "Tennis-Data.co.uk (local sync, data/public/tennis-data-wta)",
        "pbp_sha256": p["pbp_sha256"], "adf_flag": p.get("adf_flag"),
        "canonical_hist": {"winner": h["winner"], "loser": h["loser"], "score": h["score"], "tourney_id": h.get("tourney_id")},
        "games": games,
    }


def convert_slam(mapping):
    h = mapping["historical"]
    p = mapping["pbp_ref"]
    player1, player2 = p["player1"], p["player2"]
    games = []
    for g in mapping["reconstructed_games"]:
        games.append({
            "server": slot_name(g["server"], "player1", "player2"),
            "tiebreak": bool(g.get("tiebreak")),
            "points": [{"winner": slot_name(pt["winner"], "player1", "player2"), "ace": pt.get("ace"), "double_fault": pt.get("df")} for pt in g["points"]],
        })
    return {
        "tour": "WTA_MAIN", "year": mapping["year"], "player1": player1, "player2": player2,
        "tournament": h["tournament"], "date": h.get("tourney_start_date"), "round": p.get("round") or h["round"],
        "surface": h["surface"], "event_level": "G", "best_of": h["best_of"],
        "source": "SACKMANN_SLAM_ARCHIVE", "trust_level": mapping["trust_level"],
        "independent_verification_source": None,
        "pbp_sha256": p["pbp_sha256"], "adf_flag": None,
        "canonical_hist": {"winner": h["winner"], "loser": h["loser"], "score": h["score"], "tourney_id": h.get("tourney_id")},
        "slam": mapping.get("slam"), "match_id": mapping.get("match_id"),
        "games": games,
    }


def strip_games_on_disk(path, key):
    """The audit trail's verified-mappings.json is a durable record of which
    historical match matched which PBP candidate (identity, scores, hashes) --
    it does not need to duplicate the full per-point game sequence, which is
    the actual consumable evidence artifact this script writes to
    data/metrics/pbp/wta_main/approved-index.jsonl. Stripping it here (after
    it has already been read into `rows` below) keeps one on-disk copy of the
    point data instead of two."""
    data = json.loads(Path(path).read_text())
    for m in data:
        m.pop(key, None)
    Path(path).write_text(json.dumps(data, indent=2) + "\n")


def main():
    rows = []
    for f in sorted(glob.glob("data/audit/verified-pbp-v4/wta_main/*/verified-mappings.json")):
        for m in json.loads(Path(f).read_text()):
            rows.append(convert_nonslam(m))
        strip_games_on_disk(f, "reconstructed_games")
    for f in sorted(glob.glob("data/audit/verified-pbp-v4/wta_main_slam/*/*/verified-mappings.json")):
        for m in json.loads(Path(f).read_text()):
            rows.append(convert_slam(m))
        strip_games_on_disk(f, "reconstructed_games")

    seen_sha = set()
    deduped = []
    for r in rows:
        if r["pbp_sha256"] in seen_sha:
            continue
        seen_sha.add(r["pbp_sha256"])
        r["match_key"] = hashlib.sha256(f"{r['tour']}|{r['year']}|{r['tournament']}|{r['date']}|{sorted([r['player1'].lower(), r['player2'].lower()])}".encode()).hexdigest()[:24]
        r["status"] = "APPROVED_WTA_MAIN_PBP"
        deduped.append(r)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w") as f:
        for r in deduped:
            f.write(json.dumps(r, separators=(",", ":")) + "\n")

    by_source = {}
    by_year = {}
    for r in deduped:
        by_source[r["source"]] = by_source.get(r["source"], 0) + 1
        by_year[r["year"]] = by_year.get(r["year"], 0) + 1
    print(f"Wrote {len(deduped)} rows to {OUT_PATH} (dropped {len(rows) - len(deduped)} sha256 duplicates)")
    print("By source:", by_source)
    print("By year:", dict(sorted(by_year.items())))


if __name__ == "__main__":
    main()
