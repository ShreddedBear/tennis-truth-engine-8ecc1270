#!/usr/bin/env python3
"""Validate synced PredixSport tennis files and build compact player indexes.

No values are invented. Output is derived only from columns actually present in
PredixSport's CC BY 4.0 CSV files.
"""
from __future__ import annotations
import csv, json, re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "public" / "predixsport"
OUT = BASE / "generated"
OUT.mkdir(parents=True, exist_ok=True)

DATE_KEYS = ("date", "match_date", "tourney_date", "start_date", "event_date")
PLAYER_KEYS = ("player", "player_name", "name", "winner_name", "loser_name", "player1", "player2")

def year_of(v: str):
    if not v: return None
    m = re.search(r"(?:19|20)\d{2}", v)
    return int(m.group()) if m else None

def inspect(path: Path):
    years=[]; rows=0; headers=[]
    players=defaultdict(lambda: {"rows":0,"first_year":None,"last_year":None})
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader=csv.DictReader(f); headers=reader.fieldnames or []
        date_cols=[h for h in headers if h.lower() in DATE_KEYS or "date" in h.lower()]
        player_cols=[h for h in headers if h.lower() in PLAYER_KEYS or h.lower().endswith("_name")]
        for row in reader:
            rows += 1
            y=None
            for c in date_cols:
                y=year_of(row.get(c, ""))
                if y: break
            if y: years.append(y)
            for c in player_cols:
                name=(row.get(c) or "").strip()
                if not name: continue
                p=players[name]; p["rows"] += 1
                if y:
                    p["first_year"] = y if p["first_year"] is None else min(p["first_year"], y)
                    p["last_year"] = y if p["last_year"] is None else max(p["last_year"], y)
    return {
        "file": str(path.relative_to(ROOT)), "rows": rows, "columns": headers,
        "first_year": min(years) if years else None, "last_year": max(years) if years else None,
        "players": dict(players),
    }

files=list((BASE/"atp").glob("*.csv"))+list((BASE/"wta").glob("*.csv"))
reports=[inspect(p) for p in files]
summary={
    "generated_at": datetime.utcnow().isoformat(timespec="seconds")+"Z",
    "license":"CC BY 4.0", "source":"PredixSport",
    "files":[{k:v for k,v in r.items() if k!="players"} for r in reports],
}
(OUT/"dataset-summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
for tour in ("atp","wta"):
    merged={}
    for r in reports:
        if f"/{tour}/" not in "/"+r["file"]: continue
        for name, p in r["players"].items():
            q=merged.setdefault(name,{"rows":0,"first_year":None,"last_year":None})
            q["rows"] += p["rows"]
            for key, fn in (("first_year",min),("last_year",max)):
                val=p[key]
                if val is not None: q[key]=val if q[key] is None else fn(q[key],val)
    (OUT/f"{tour}-player-index.json").write_text(json.dumps(merged,separators=(",",":")),encoding="utf-8")
print(json.dumps(summary,indent=2))
