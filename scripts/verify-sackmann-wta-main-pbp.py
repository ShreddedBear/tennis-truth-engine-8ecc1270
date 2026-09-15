#!/usr/bin/env python3
"""WTA MAIN TOUR historical point-by-point verifier (Sackmann/ppaulojr archive).

Root causes this fixes, relative to scripts/verify-sackmann-pbp-v4.py:

1. MAIN_LEVELS in the v4 script is an ATP-shaped level set ({'G','M','A','F'}).
   WTA's real tourney_level codes (confirmed against
   Aneeshers/tennis-sackmann-archive/wta/wta_matches_<year>.csv) are
   G=Grand Slam, PM=Premier Mandatory, P=Premier, I=International, F=Tour
   Championships, D=Fed Cup (team), O=Olympics. Reusing the ATP set silently
   dropped every WTA Premier/Premier Mandatory/International match (the bulk
   of the WTA main-tour season) before PBP matching even started -- only
   Grand Slam + Finals survived (538 of 2,517 hist rows for 2012).
2. v4's independent-verification step (read_td) live-fetches
   tennis-data.co.uk on every run. That domain is unreachable from this
   sandbox (and was unreachable when v4's own ATP 2012/2013 runs were
   produced -- see data/audit/verified-pbp-v4/atp_main/2012/summary.json,
   "independent_result_source_error": "...:URLError" on every candidate
   URL), which pins verified coverage at 0% forever. This script instead
   reads the *already-synced, already-committed* local file
   data/public/tennis-data-wta/wta_matches_2007_2016.csv (produced by
   .github/workflows/sync-tennis-data-wta.yml, which genuinely reached
   tennis-data.co.uk from a GitHub Actions runner) -- no live fetch needed
   for years 2007-2016, which is exactly where the real point-level source
   (ppaulojr/tennis_pointbypoint) has data (2010-2015).
3. The real point-level source was never actually broken: PBP_BASE in v4
   pointed at ppaulojr/tennis_pointbypoint, which is a real, reachable,
   genuine point-by-point archive (S/R/A/D per-point grammar, README:
   "Sequential point-by-point data for tens of thousands of pro matches").
   Confirmed reachable via raw.githubusercontent.com from this sandbox.

Never fabricates or infers missing points: a match is only marked
RESULT_VERIFIED_PBP when (a) a real PBP candidate's player pair + winner +
score + tournament matches a canonical historical match, (b) an
independent, differently-sourced result (local Tennis-Data.co.uk sync)
agrees on date + player pair + score + tournament, (c) the PBP string
itself replays into a structurally legal tennis match (game/set/tiebreak
grammar) whose reconstructed score and winner match the historical record,
and (d) no historical match or PBP candidate is reused (uniqueness /
duplicate-protection firewall, same design as v4).
"""
from __future__ import annotations
import csv, hashlib, html, io, json, re, sys, unicodedata, urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

VERIFIER_VERSION = 1
ROOT = Path("data/audit/verified-pbp-v4")
HIST_BASE = "https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main"
PBP_BASE = "https://raw.githubusercontent.com/ppaulojr/tennis_pointbypoint/master"
PBP_FILES = ["pbp_matches_wta_main_archive.csv", "pbp_matches_wta_main_current.csv"]
LOCAL_TD_PATH = Path("data/public/tennis-data-wta/wta_matches_2007_2016.csv")
# WTA main-tour individual ranking-points events. Deliberately excludes D
# (Fed Cup -- team competition, not individual match play) and O (Olympics
# -- one-off, non-ranking-points event with its own draw rules). This is a
# scope decision, not a data-availability gap; documented in the final
# report rather than silently expanded.
WTA_MAIN_LEVELS = {"G", "PM", "P", "I", "F"}
UA = "tennis-truth-engine-wta-main-pbp/1.0"


def fetch_bytes(url, timeout=90):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fetch_text(url):
    return fetch_bytes(url).decode("utf-8-sig", "replace")


def norm_name(v):
    return re.sub(r"[^a-z0-9]+", "", unicodedata.normalize("NFKD", str(v or "")).encode("ascii", "ignore").decode().lower())


def norm_tny(v):
    s = html.unescape(str(v or ""))
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(atp|wta)\b", "", s)
    s = re.sub(r"20\d{2}", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)


# Same combined WTA/ATP event, different title-sponsor era between the two sources: the
# non-slam PBP archive (ppaulojr) labels a match with whatever sponsor name was current the
# year it was scraped, while the independent Tennis-Data.co.uk sync can carry an older or
# newer sponsor name for the same event -- confirmed by direct inspection (Miami 2013:
# ppaulojr tags it "SonyOpenTennis-WTAMiami", Tennis-Data's own 2013 row says "Sony Ericsson
# Open", the tournament's PRIOR sponsor name; Cincinnati: ppaulojr "Western&SouthernOpen",
# Tennis-Data "Western & Southern Financial Group Women's Open"). tny_ok's plain substring
# check can never bridge these, since neither name is a substring of the other. Each key
# below is a stable, sponsor-name-independent event identifier; every listed alias
# (confirmed against the actual local Tennis-Data.co.uk file and/or the ppaulojr archive,
# not guessed) normalizes to that key before the substring check runs.
TOURNAMENT_ALIASES: dict[str, list[str]] = {
    "miami": ["miami", "sonyericssonopen", "sonyopentennis", "miamiopen", "miamimasters"],
    "cincinnati": ["cincinnati", "westernsouthern"],
    "indianwells": ["indianwells", "bnpparibasopen", "pacificlifeopen"],
}


def canonical_tny_alias(normalized: str) -> str | None:
    for key, aliases in TOURNAMENT_ALIASES.items():
        if any(a in normalized or normalized in a for a in aliases):
            return key
    return None


def tny_ok(a, b):
    x, y = norm_tny(a), norm_tny(b)
    if not x or not y:
        return False
    if x in y or y in x:
        return True
    ax, ay = canonical_tny_alias(x), canonical_tny_alias(y)
    return ax is not None and ax == ay


def pairkey(a, b):
    return tuple(sorted((norm_name(a), norm_name(b))))


def lastname_initial_key(full_name):
    """('Lucie Safarova') -> ('safarova','l'); ('Carla Suarez Navarro') -> ('suareznavarro','c').

    Bug this fixes: taking only the FINAL whitespace-separated token as "the surname"
    breaks every double-surname player (Spanish "Suarez Navarro", "Medina Garrigues";
    Croatian "Kostanic Tosic"; etc.) -- confirmed against the local Tennis-Data.co.uk file,
    which spells these the same way ("Suarez Navarro C."). The surname is everything after
    the first (given-name) token, matching td_name_key's own convention below so the two
    sides key identically regardless of how many words the surname has.
    """
    parts = [p for p in re.split(r"\s+", unicodedata.normalize("NFKD", str(full_name or "")).encode("ascii", "ignore").decode().strip()) if p]
    if len(parts) < 2:
        return None
    last = re.sub(r"[^a-z]", "", "".join(parts[1:]).lower())
    first = re.sub(r"[^a-z]", "", parts[0].lower())
    if not last or not first:
        return None
    return (last, first[0])


def td_name_key(td_name):
    """('Safarova L.') -> ('safarova','l'); ('Suarez Navarro C.') -> ('suareznavarro','c').

    Bug this fixes: the previous regex `([A-Za-z'-]+)\\s+([A-Za-z])` stops its surname
    capture at the FIRST space, so a two-word surname like "Suarez Navarro C." parsed as
    surname="Suarez", initial="N" (the first letter of "Navarro", not the real initial) --
    silently wrong, not merely a miss. Tennis-Data's own format is always
    "<all surname words> <single-letter initial>.", so the real initial is always the LAST
    token, and the surname is everything before it, joined without spaces to match
    lastname_initial_key's own convention above.
    """
    parts = [p for p in re.split(r"\s+", str(td_name or "").strip()) if p]
    if len(parts) < 2:
        return None
    initial = re.sub(r"[^A-Za-z]", "", parts[-1])
    if len(initial) != 1:
        return None
    surname = re.sub(r"[^a-z]", "", "".join(parts[:-1]).lower())
    if not surname:
        return None
    return (surname, initial.lower())


def td_pairkey(w, l):
    a, b = td_name_key(w), td_name_key(l)
    if not a or not b:
        return None
    return tuple(sorted((a, b)))


def parse_date(v):
    s = str(v or "").strip()
    for f in ("%d %b %y", "%Y-%m-%d", "%Y%m%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, f).date().isoformat()
        except ValueError:
            pass
    return ""


# ppaulojr's per-match `date` and the local Tennis-Data.co.uk sync's `date` are not always
# the same calendar day for the same real match -- confirmed by direct inspection (e.g. a
# Miami 2013 match ppaulojr dates 2013-03-18, Tennis-Data dates 2013-03-20; both are inside
# the same 12-day tournament, so this is a per-source logging-convention difference, not
# two different matches). Exact date equality was too strict a filter for the pair+date
# lookup below. A short tolerance window is safe here specifically because every other
# check (player-pair identity, winner name, score, tournament) still must also match exactly
# -- widening only the date comparison does not on its own let an unrelated match through.
DATE_TOLERANCE_DAYS = 3


def dates_within_tolerance(a: str, b: str, max_days: int) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    try:
        da, db = datetime.strptime(a, "%Y-%m-%d"), datetime.strptime(b, "%Y-%m-%d")
    except ValueError:
        return False
    return abs((da - db).days) <= max_days


def clean_score(v):
    return re.sub(r"\s+", " ", str(v or "").upper().replace("RET", "").replace("DEF", "").replace("W/O", "").strip())


def score_games(v):
    out = []
    for tok in clean_score(v).split():
        m = re.match(r"^(\d+)-(\d+)", tok)
        if m:
            out.append((int(m.group(1)), int(m.group(2))))
    return out


def game_winner(seq, server, tb=False):
    cur = server
    p = [0, 0]
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
        p[w] += 1
        terminal = (max(p) >= 7 and abs(p[0] - p[1]) >= 2) if tb else (max(p) >= 4 and abs(p[0] - p[1]) >= 2)
        if ended:
            return None
        if terminal:
            ended = True
    if not ended:
        return None
    return 0 if p[0] > p[1] else 1


def reconstruct(pbp):
    """Validate the S/R/A/D grammar and replay it into per-game point sequences.

    Returns {'valid':bool, 'reason':..., 'sets':[[(server_slot, [Point,...]), ...]], 'winner':0|1, 'points':n, 'games':n}
    where each Point is {'winner':0|1,'ace':bool|None,'df':bool|None} and server_slot is the
    0/1 slot serving that game (0 = server1/p1 of the pbp row, matching reconstruct()'s own server var).
    """
    if not pbp:
        return {"valid": False, "reason": "EMPTY_PBP"}
    server = 0
    sets = []
    points = 0
    for blob in pbp.strip().split("."):
        if not blob:
            return {"valid": False, "reason": "EMPTY_SET"}
        wins = [0, 0]
        set_games = []
        for game in [x for x in blob.split(";") if x]:
            tb = "/" in game
            w = game_winner(game, server, tb)
            if w is None:
                return {"valid": False, "reason": "ILLEGAL_GAME"}
            game_points = []
            cur = server
            for ch in game:
                if ch == "/":
                    if not tb:
                        return {"valid": False, "reason": "ILLEGAL_GAME"}
                    cur = 1 - cur
                    continue
                pw = cur if ch in "SA" else 1 - cur
                game_points.append({"winner": pw, "ace": True if ch == "A" else (False if ch in "SR" else None), "df": True if ch == "D" else (False if ch in "SR" else None)})
            wins[w] += 1
            points += len(game_points)
            set_games.append({"server": server, "tiebreak": tb, "points": game_points})
            server = 1 - server
        a, b = wins
        if not ((max(a, b) >= 6 and abs(a - b) >= 2) or (a, b) in ((7, 6), (6, 7))):
            return {"valid": False, "reason": "ILLEGAL_SET", "sets": sets + [set_games]}
        sets.append(set_games)
    set_wins = [0, 0]
    for s in sets:
        a = sum(1 for g in s if game_winner_from_points(g) == 0)
        b = sum(1 for g in s if game_winner_from_points(g) == 1)
        if a > b:
            set_wins[0] += 1
        elif b > a:
            set_wins[1] += 1
    if set_wins[0] == set_wins[1]:
        return {"valid": False, "reason": "NO_MATCH_WINNER", "sets": sets}
    return {"valid": True, "sets": sets, "winner": 0 if set_wins[0] > set_wins[1] else 1, "points": points, "games": sum(len(s) for s in sets)}


def game_winner_from_points(g):
    a = sum(1 for p in g["points"] if p["winner"] == 0)
    b = sum(1 for p in g["points"] if p["winner"] == 1)
    return 0 if a > b else 1


def hist_url(year):
    return f"{HIST_BASE}/wta/wta_matches_{year}.csv"


def load_hist_year(year):
    rows = list(csv.DictReader(io.StringIO(fetch_text(hist_url(year)))))
    out = []
    for i, r in enumerate(rows):
        level = (r.get("tourney_level") or "").upper()
        if level not in WTA_MAIN_LEVELS:
            continue
        out.append({
            "hist_index": i, "tour": "WTA_MAIN", "year": year,
            "tourney_start_date": parse_date(r.get("tourney_date")),
            "tournament": r.get("tourney_name", ""), "surface": r.get("surface", ""),
            "level": level, "round": r.get("round", ""),
            "winner": r.get("winner_name", ""), "loser": r.get("loser_name", ""),
            "winner_id": r.get("winner_id", ""), "loser_id": r.get("loser_id", ""),
            "score": clean_score(r.get("score", "")), "best_of": r.get("best_of", ""),
            "match_num": r.get("match_num", ""), "tourney_id": r.get("tourney_id", ""),
        })
    return out


def load_pbp(year):
    out = []
    errors = []
    for fn in PBP_FILES:
        try:
            text = fetch_text(f"{PBP_BASE}/{fn}")
        except Exception as e:
            errors.append({"source": fn, "error": type(e).__name__})
            continue
        for idx, r in enumerate(csv.DictReader(io.StringIO(text))):
            d = parse_date(r.get("date"))
            if not d or int(d[:4]) != year:
                continue
            if (r.get("tour") or "").upper() != "WTA" or (r.get("draw") or "").lower() != "main":
                continue
            raw = r.get("pbp", "") or ""
            out.append({
                "source_file": fn, "source_row": idx + 2, "date": d,
                "tournament": r.get("tny_name", ""), "server1": r.get("server1", ""),
                "server2": r.get("server2", ""), "winner": r.get("winner", ""),
                "score": clean_score(r.get("score", "")), "pbp": raw,
                "adf_flag": r.get("adf_flag", ""),
                "pbp_sha256": hashlib.sha256(raw.encode()).hexdigest(),
            })
    return out, errors


def load_local_td(year):
    if not LOCAL_TD_PATH.exists():
        return None, "LOCAL_TD_FILE_MISSING"
    with LOCAL_TD_PATH.open(encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    out = []
    for r in rows:
        if str(r.get("season", "")).strip() != str(year):
            continue
        d = str(r.get("date", "")).strip()
        if not d:
            continue
        sets = []
        for i in range(1, 6):
            w, l = r.get(f"w{i}", ""), r.get(f"l{i}", "")
            if str(w).strip() and str(l).strip():
                sets.append(f"{w}-{l}")
        out.append({
            "date": d, "winner": r.get("winner", ""), "loser": r.get("loser", ""),
            "tournament": r.get("tournament", ""), "surface": r.get("surface", ""),
            "round": r.get("round", ""), "score": clean_score(" ".join(sets)),
            "source_url": r.get("source_url", ""),
        })
    return out, None


def run(year):
    hist = load_hist_year(year)
    pbps, pbp_errors = load_pbp(year)
    td, td_error = load_local_td(year)
    by_pair_h = defaultdict(list)
    for h in hist:
        by_pair_h[pairkey(h["winner"], h["loser"])].append(h)
    by_pair_td = defaultdict(list)
    if td is not None:
        for x in td:
            k = td_pairkey(x["winner"], x["loser"])
            if k:
                by_pair_td[k].append(x)

    cand_h = defaultdict(list)
    cand_td = defaultdict(list)
    for pi, p in enumerate(pbps):
        pk = pairkey(p["server1"], p["server2"])
        pwin_name = p["server1"] if str(p["winner"]) == "1" else p["server2"] if str(p["winner"]) == "2" else ""
        for h in by_pair_h.get(pk, []):
            if norm_name(pwin_name) != norm_name(h["winner"]):
                continue
            if p["score"] and h["score"] and score_games(p["score"]) != score_games(h["score"]):
                continue
            if not tny_ok(h["tournament"], p["tournament"]):
                continue
            cand_h[pi].append(h)
        if td is not None:
            k1, k2 = lastname_initial_key(p["server1"]), lastname_initial_key(p["server2"])
            pk_td = tuple(sorted((k1, k2))) if k1 and k2 else None
            pwin_key = lastname_initial_key(pwin_name)
            for x in by_pair_td.get(pk_td, []) if pk_td else []:
                if not dates_within_tolerance(x["date"], p["date"], DATE_TOLERANCE_DAYS):
                    continue
                xw = td_name_key(x["winner"])
                if not pwin_key or xw != pwin_key:
                    continue
                if p["score"] and x["score"] and score_games(p["score"]) != score_games(x["score"]):
                    continue
                if not tny_ok(x["tournament"], p["tournament"]):
                    continue
                cand_td[pi].append(x)

    hist_to_p = defaultdict(list)
    for pi, hs in cand_h.items():
        for h in hs:
            hist_to_p[h["hist_index"]].append(pi)

    used_h, used_p = set(), set()
    counts = Counter()
    records = []
    verified = []
    for h in hist:
        his = h["hist_index"]
        pis = hist_to_p.get(his, [])
        if not pis:
            st = "NO_PBP_AVAILABLE"
            counts[st] += 1
            records.append({"hist": h, "status": st})
            continue
        if td is None:
            st = "ACCESS_LIMITATION"
            counts[st] += 1
            records.append({"hist": h, "status": st, "reason": td_error, "candidate_count": len(pis)})
            continue
        eligible = []
        for pi in pis:
            tds = cand_td.get(pi, [])
            if len(tds) != 1:
                continue
            x = tds[0]
            if h["surface"] and x["surface"] and h["surface"].lower() != x["surface"].lower():
                continue
            eligible.append(pi)
        if not eligible:
            st = "REVIEW_REQUIRED"
            counts[st] += 1
            records.append({"hist": h, "status": st, "candidate_count": len(pis)})
            continue
        if len(eligible) != 1:
            st = "AMBIGUOUS_MATCH"
            counts[st] += 1
            records.append({"hist": h, "status": st, "candidate_count": len(eligible)})
            continue
        pi = eligible[0]
        p = pbps[pi]
        rev = [hh for hh in cand_h.get(pi, []) if len(cand_td.get(pi, [])) == 1]
        if len(rev) != 1:
            st = "AMBIGUOUS_MATCH"
            counts[st] += 1
            records.append({"hist": h, "status": st, "reverse_candidate_count": len(rev)})
            continue
        if his in used_h or pi in used_p:
            st = "PBP_CONFLICT"
            counts[st] += 1
            records.append({"hist": h, "status": st, "reason": "DUPLICATE_PROTECTION"})
            continue
        rec = reconstruct(p["pbp"])
        if not rec.get("valid"):
            st = "PBP_UNUSABLE"
            counts[st] += 1
            records.append({"hist": h, "status": st, "validation": {"valid": False, "reason": rec.get("reason")}})
            continue
        pg = [(sum(1 for g in s if game_winner_from_points(g) == 0), sum(1 for g in s if game_winner_from_points(g) == 1)) for s in rec["sets"]]
        if norm_name(h["winner"]) == norm_name(p["server2"]):
            pg = [(b, a) for a, b in pg]
        if pg != score_games(h["score"]):
            st = "PBP_CONFLICT"
            counts[st] += 1
            records.append({"hist": h, "status": st, "reason": "RECONSTRUCTED_SCORE_MISMATCH", "reconstructed": pg, "historical": score_games(h["score"])})
            continue
        pwi = 0 if norm_name(h["winner"]) == norm_name(p["server1"]) else 1
        if rec["winner"] != pwi:
            st = "PBP_CONFLICT"
            counts[st] += 1
            records.append({"hist": h, "status": st, "reason": "RECONSTRUCTED_WINNER_MISMATCH"})
            continue
        used_h.add(his)
        used_p.add(pi)
        counts["RESULT_VERIFIED_PBP"] += 1
        x = cand_td[pi][0]
        mapping = {
            "tour": "WTA_MAIN", "year": year, "historical": h,
            "exact_match_date": p["date"], "independent_result_verification": x,
            "pbp_ref": {k: p[k] for k in ("source_file", "source_row", "date", "tournament", "server1", "server2", "winner", "score", "pbp_sha256", "adf_flag")},
            "reconstructed_games": rec["sets"], "player1_slot_is_pbp_server1": True,
            "trust_level": "LEVEL_1_RESULT_VERIFIED_PBP", "verifier_version": VERIFIER_VERSION,
        }
        verified.append(mapping)
        records.append({"hist": h, "status": "RESULT_VERIFIED_PBP", "pbp_ref": mapping["pbp_ref"], "trust_level": mapping["trust_level"]})

    total = len(hist)
    verified_n = counts["RESULT_VERIFIED_PBP"]
    summary = {
        "verifier_version": VERIFIER_VERSION, "tour": "WTA_MAIN", "year": year,
        "historical_matches": total, "pbp_candidates": len(pbps),
        "verified": verified_n, "review_required": counts["REVIEW_REQUIRED"],
        "ambiguous": counts["AMBIGUOUS_MATCH"],
        "conflicts": counts["PBP_CONFLICT"] + counts["PBP_UNUSABLE"],
        "no_pbp": counts["NO_PBP_AVAILABLE"], "retrieval_failures": len(pbp_errors),
        "access_limitations": counts["ACCESS_LIMITATION"],
        "coverage_pct": round(100 * verified_n / total, 2) if total else 0.0,
        "independent_result_source": str(LOCAL_TD_PATH) if td is not None else None,
        "independent_result_source_error": td_error,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    d = ROOT / "wta_main" / str(year)
    d.mkdir(parents=True, exist_ok=True)
    (d / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    (d / "verified-mappings.json").write_text(json.dumps(verified, indent=2) + "\n")
    (d / "records.json").write_text(json.dumps(records, indent=2) + "\n")
    print("BATCH_RESULT " + json.dumps(summary, separators=(",", ":")))
    return summary


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", required=True, type=int)
    a = ap.parse_args()
    run(a.year)
