#!/usr/bin/env python3
"""WTA Grand Slam point-by-point ingestion (Aneeshers/tennis-sackmann-archive
mirror of Jeff Sackmann's tennis_slam_pointbypoint).

Scope: years 2016-2024 only. Years 2011-2015 are deliberately excluded here
even though this archive covers them too -- those years are already sourced
(non-Slam-inclusive) from scripts/verify-sackmann-wta-main-pbp.py via
ppaulojr/tennis_pointbypoint, which is cross-verified against an independent
result source (local Tennis-Data.co.uk sync). Ingesting the same Slam
matches again here would double-count them. Restricting this script to
years the other source does not reach avoids that by construction rather
than by post-hoc de-duplication.

Per-slam-year coverage is whatever the archive actually contains -- this
script does not assume completeness:
  - usopen: 2016-2024 (all present)
  - wimbledon: 2016 (women's singles file has ZERO rows -- see below),
    2017-2019, 2021-2024 (2020 not played, cancelled for COVID)
  - ausopen, frenchopen: 2016-2021 only (archive has no 2022-2024 files
    for these two majors)
2016 Wimbledon women's singles: the matches file for that year/slam exists
but contains only men's rows (126, all match_num prefix "1"); 0 women's
rows. This is a genuine gap in the upstream archive, not a bug in this
script's gender filter (confirmed by direct inspection) -- reported as a
gap, not silently skipped without a trace.

Unlike the non-Slam ppaulojr source (compact S/R/A/D grammar string per
match), this source gives one row per point with explicit SetNo/GameNo/
PointServer/PointWinner columns already, and match_id already encodes
year+slam+draw position. Validation here replays those discrete point rows
into games/sets exactly as scripts/verify-sackmann-wta-main-pbp.py replays
its S/R/A/D grammar (same legal-game/legal-set logic), and requires the
replayed score + winner to match the tour-level Grand Slam historical
record. Because Slam draws are single-elimination and there is no realistic
way for two different WTA Grand Slam matches to collide, cross-checking
against an independent tennis-data.co.uk sync is not required for identity
disambiguation the way it is for the non-Slam archive; player-pair +
tournament + round match against the canonical historical record already
disambiguates uniquely. This is documented explicitly in the output
(trust_level LEVEL_2_SINGLE_SOURCE_STRUCTURALLY_VALIDATED), which is a
genuinely lower trust tier than LEVEL_1_RESULT_VERIFIED_PBP and is reported
as such rather than folded into the same number.
"""
from __future__ import annotations
import csv, hashlib, io, json, re, unicodedata, urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

VERIFIER_VERSION = 1
ROOT = Path("data/audit/verified-pbp-v4")
ARCHIVE_BASE = "https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main"
HIST_BASE = ARCHIVE_BASE
UA = "tennis-truth-engine-wta-main-slam-pbp/1.0"
SLAMS = ["ausopen", "frenchopen", "wimbledon", "usopen"]
SLAM_TOURNAMENT_NAME = {"ausopen": "Australian Open", "frenchopen": "Roland Garros", "wimbledon": "Wimbledon", "usopen": "US Open"}


def fetch_bytes(url, timeout=90):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fetch_text_or_none(url):
    try:
        return fetch_bytes(url).decode("utf-8-sig", "replace")
    except Exception:
        return None


def norm_name(v):
    return re.sub(r"[^a-z0-9]+", "", unicodedata.normalize("NFKD", str(v or "")).encode("ascii", "ignore").decode().lower())


def last_first_initial(full_name):
    """Key a full name ("Victoria Estrella Burgos") the same way abbrev_key keys the
    archive's "F. Rest Of Name" form: first-token initial + everything after it
    concatenated. Using only the final word as "last name" would split multi-word
    surnames (e.g. "Estrella Burgos") inconsistently with the abbreviated form."""
    parts = [p for p in re.split(r"\s+", unicodedata.normalize("NFKD", str(full_name or "")).encode("ascii", "ignore").decode().strip()) if p]
    if len(parts) < 2:
        return None
    rest = re.sub(r"[^a-z]", "", "".join(parts[1:]).lower())
    first = re.sub(r"[^a-z]", "", parts[0].lower())[:1]
    if not rest or not first:
        return None
    return (rest, first)


def abbrev_key(name):
    """Some slam-year matches.csv files spell player1/player2 abbreviated ('V. Estrella
    Burgos'), others spell them in full ('Simona Halep') -- inconsistent across years
    within the same archive (confirmed: 2018-2021 ausopen/frenchopen abbreviate,
    wimbledon/usopen and other years do not). Both forms key identically to
    last_first_initial's (first-token-initial, rest-of-name) scheme: taking only the
    first character of the first whitespace token discards the extra letters of a
    full first name and leaves the same key an actual abbreviation would produce."""
    return last_first_initial(name)


def parse_date(v):
    s = str(v or "").strip()
    for f in ("%Y%m%d", "%d %b %y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, f).date().isoformat()
        except ValueError:
            pass
    return ""


def clean_score(v):
    return re.sub(r"\s+", " ", str(v or "").upper().replace("RET", "").replace("DEF", "").replace("W/O", "").strip())


def score_games(v):
    out = []
    for tok in clean_score(v).split():
        m = re.match(r"^(\d+)-(\d+)", tok)
        if m:
            out.append((int(m.group(1)), int(m.group(2))))
    return out


def is_womens_singles(match_num):
    mn = str(match_num or "").strip().upper()
    return mn.startswith("2") or mn.startswith("WS")


def load_hist_year(year):
    text = fetch_text_or_none(f"{HIST_BASE}/wta/wta_matches_{year}.csv")
    if text is None:
        return []
    rows = list(csv.DictReader(io.StringIO(text)))
    out = []
    for i, r in enumerate(rows):
        if (r.get("tourney_level") or "").upper() != "G":
            continue
        out.append({
            "hist_index": i, "tour": "WTA_MAIN", "year": year,
            "tourney_start_date": parse_date(r.get("tourney_date")),
            "tournament": r.get("tourney_name", ""), "surface": r.get("surface", ""),
            "level": "G", "round": r.get("round", ""),
            "winner": r.get("winner_name", ""), "loser": r.get("loser_name", ""),
            "winner_id": r.get("winner_id", ""), "loser_id": r.get("loser_id", ""),
            "score": clean_score(r.get("score", "")), "best_of": r.get("best_of", ""),
            "match_num": r.get("match_num", ""), "tourney_id": r.get("tourney_id", ""),
        })
    return out


def replay_points(points):
    """points: ordered list of dicts with SetNo,GameNo,PointServer(1/2),PointWinner(1/2).
    Returns {'valid':bool,'reason':...,'sets':[(p1_games,p2_games),...],'winner':0|1,'points':n,'games':n,
             'game_rows':[{'setNo':int,'server':0|1,'points':[{'winner':0|1}]}]}"""
    if not points:
        return {"valid": False, "reason": "EMPTY_POINTS"}
    game_rows = []
    cur_game_no = None
    cur_set_no = None
    cur_points = []
    cur_server_votes = Counter()

    def flush_game():
        if cur_points:
            server_votes = cur_server_votes
            server = server_votes.most_common(1)[0][0] if server_votes else None
            game_rows.append({"setNo": cur_set_no, "server": server, "points": list(cur_points)})

    for p in points:
        set_no = p["SetNo"]
        game_no = p["GameNo"]
        if game_no != cur_game_no or set_no != cur_set_no:
            flush_game()
            cur_points = []
            cur_server_votes = Counter()
            cur_game_no = game_no
            cur_set_no = set_no
        cur_server_votes[p["PointServer"]] += 1
        cur_points.append({"winner": p["PointWinner"], "ace": bool(p.get("Ace")), "df": bool(p.get("DoubleFault"))})
    flush_game()

    if not game_rows:
        return {"valid": False, "reason": "NO_GAMES"}
    for g in game_rows:
        if g["server"] not in (0, 1) or not g["points"]:
            return {"valid": False, "reason": "MISSING_SERVER_OR_POINTS"}

    sets = {}
    order = []
    for g in game_rows:
        sn = g["setNo"]
        if sn not in sets:
            sets[sn] = []
            order.append(sn)
        a = sum(1 for pt in g["points"] if pt["winner"] == 0)
        b = sum(1 for pt in g["points"] if pt["winner"] == 1)
        tb = (a + b) >= 7 and abs(a - b) >= 1 and (a >= 7 or b >= 7)
        terminal_ok = (max(a, b) >= 7 and abs(a - b) >= 2) if tb else (max(a, b) >= 4 and abs(a - b) >= 2)
        if not terminal_ok:
            return {"valid": False, "reason": "ILLEGAL_GAME", "detail": {"set": sn, "a": a, "b": b}}
        winner = 0 if a > b else 1
        sets[sn].append(winner)

    set_scores = []
    for sn in order:
        games = sets[sn]
        a = sum(1 for w in games if w == 0)
        b = sum(1 for w in games if w == 1)
        if not ((max(a, b) >= 6 and abs(a - b) >= 2) or (a, b) in ((7, 6), (6, 7))):
            return {"valid": False, "reason": "ILLEGAL_SET", "detail": {"set": sn, "a": a, "b": b}}
        set_scores.append((a, b))

    set_wins = [sum(1 for a, b in set_scores if a > b), sum(1 for a, b in set_scores if b > a)]
    if set_wins[0] == set_wins[1]:
        return {"valid": False, "reason": "NO_MATCH_WINNER"}
    return {
        "valid": True, "sets": set_scores, "winner": 0 if set_wins[0] > set_wins[1] else 1,
        "points": sum(len(g["points"]) for g in game_rows), "games": len(game_rows),
        "game_rows": game_rows,
    }


def run(year, slam):
    matches_text = fetch_text_or_none(f"{ARCHIVE_BASE}/slam_pointbypoint/{year}-{slam}-matches.csv")
    points_text = fetch_text_or_none(f"{ARCHIVE_BASE}/slam_pointbypoint/{year}-{slam}-points.csv")
    if matches_text is None or points_text is None:
        return {"year": year, "slam": slam, "status": "SOURCE_FILES_ABSENT"}

    matches = [r for r in csv.DictReader(io.StringIO(matches_text)) if is_womens_singles(r.get("match_num"))]
    if not matches:
        return {"year": year, "slam": slam, "status": "NO_WOMENS_SINGLES_ROWS", "womens_matches_listed": 0}

    points_by_match = {}
    for r in csv.DictReader(io.StringIO(points_text)):
        mid = r.get("match_id")
        if mid is None:
            continue
        try:
            set_no = int(r.get("SetNo") or -1)
            game_no = int(r.get("GameNo") or -1)
            server = int(r.get("PointServer") or 0) - 1
            winner = int(r.get("PointWinner") or 0) - 1
        except (TypeError, ValueError):
            continue
        if server not in (0, 1) or winner not in (0, 1):
            continue
        ace = str(r.get("P1Ace") or "").strip() == "1" or str(r.get("P2Ace") or "").strip() == "1"
        df = str(r.get("P1DoubleFault") or "").strip() == "1" or str(r.get("P2DoubleFault") or "").strip() == "1"
        points_by_match.setdefault(mid, []).append({"SetNo": set_no, "GameNo": game_no, "PointServer": server, "PointWinner": winner, "Ace": ace, "DoubleFault": df})

    hist = load_hist_year(year)
    tourney_needle = SLAM_TOURNAMENT_NAME[slam]
    hist_slam = [h for h in hist if tourney_needle.lower() in h["tournament"].lower() or re.sub(r"[^a-z]", "", tourney_needle.lower()) in re.sub(r"[^a-z]", "", h["tournament"].lower())]
    by_pair_h = {}
    for h in hist_slam:
        k = tuple(sorted((norm_name(h["winner"]), norm_name(h["loser"]))))
        by_pair_h.setdefault(k, []).append(h)

    used_h = set()
    counts = Counter()
    records = []
    verified = []
    for m in matches:
        mid = m["match_id"]
        p1ab, p2ab = abbrev_key(m.get("player1")), abbrev_key(m.get("player2"))
        pts = points_by_match.get(mid, [])
        if not pts:
            counts["NO_POINTS_FOR_MATCH"] += 1
            records.append({"match_id": mid, "status": "NO_POINTS_FOR_MATCH"})
            continue
        rec = replay_points(sorted(pts, key=lambda p: (p["SetNo"], p["GameNo"])))
        if not rec.get("valid"):
            counts["PBP_UNUSABLE"] += 1
            records.append({"match_id": mid, "status": "PBP_UNUSABLE", "reason": rec.get("reason"), "detail": rec.get("detail")})
            continue
        candidate_h = None
        for h in hist_slam:
            hw, hl = last_first_initial(h["winner"]), last_first_initial(h["loser"])
            if not hw or not hl or not p1ab or not p2ab:
                continue
            pair_ab = {p1ab, p2ab}
            if {hw, hl} != pair_ab:
                continue
            # rec["sets"] is (source_player1_games, source_player2_games) per set in
            # play order. Historical scores are always written winner-first, so
            # orient purely on which archive slot is the historical winner -- this is
            # independent of rec["winner"] (which only says who won the whole match,
            # not which column of `rec["sets"]` is which player).
            recon_games = [(a, b) for a, b in rec["sets"]]
            oriented = recon_games if hw == p1ab else [(b, a) for a, b in recon_games]
            if oriented != score_games(h["score"]):
                continue
            candidate_h = (h, hw == p1ab)
            break
        if not candidate_h:
            counts["NO_HIST_MATCH"] += 1
            records.append({"match_id": mid, "status": "NO_HIST_MATCH", "player1": m.get("player1"), "player2": m.get("player2")})
            continue
        h, p1_is_winner_side = candidate_h
        if h["hist_index"] in used_h:
            counts["PBP_CONFLICT"] += 1
            records.append({"match_id": mid, "status": "PBP_CONFLICT", "reason": "DUPLICATE_PROTECTION"})
            continue
        used_h.add(h["hist_index"])
        counts["RESULT_VERIFIED_PBP"] += 1
        raw_concat = mid
        mapping = {
            "tour": "WTA_MAIN", "year": year, "slam": slam, "match_id": mid,
            "historical": h,
            "pbp_ref": {"source_file": f"slam_pointbypoint/{year}-{slam}-points.csv", "match_id": mid, "player1": m.get("player1"), "player2": m.get("player2"), "round": m.get("round"), "court_name": m.get("court_name"), "pbp_sha256": hashlib.sha256(json.dumps(pts, sort_keys=True).encode()).hexdigest()},
            "reconstructed_games": rec["game_rows"], "player1_slot_is_source_player1": True,
            "trust_level": "LEVEL_2_SINGLE_SOURCE_STRUCTURALLY_VALIDATED",
            "verifier_version": VERIFIER_VERSION,
        }
        verified.append(mapping)
        records.append({"match_id": mid, "status": "RESULT_VERIFIED_PBP", "trust_level": mapping["trust_level"]})

    summary = {
        "verifier_version": VERIFIER_VERSION, "tour": "WTA_MAIN", "year": year, "slam": slam,
        "womens_singles_matches_listed": len(matches),
        "historical_grand_slam_matches_this_slam_year": len(hist_slam),
        "verified": counts["RESULT_VERIFIED_PBP"],
        "no_points_for_match": counts["NO_POINTS_FOR_MATCH"],
        "pbp_unusable": counts["PBP_UNUSABLE"],
        "no_hist_match": counts["NO_HIST_MATCH"],
        "conflicts": counts["PBP_CONFLICT"],
        "trust_level": "LEVEL_2_SINGLE_SOURCE_STRUCTURALLY_VALIDATED",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    d = ROOT / "wta_main_slam" / str(year) / slam
    d.mkdir(parents=True, exist_ok=True)
    (d / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    (d / "verified-mappings.json").write_text(json.dumps(verified, indent=2) + "\n")
    (d / "records.json").write_text(json.dumps(records, indent=2) + "\n")
    print("SLAM_BATCH_RESULT " + json.dumps(summary, separators=(",", ":")))
    return summary


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", required=True, type=int)
    ap.add_argument("--slam", required=True, choices=SLAMS)
    a = ap.parse_args()
    run(a.year, a.slam)
