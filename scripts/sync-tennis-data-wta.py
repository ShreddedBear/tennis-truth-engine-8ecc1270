#!/usr/bin/env python3
"""Download and normalize Tennis-Data.co.uk WTA historical match seasons.

Tennis-Data's WTA archive begins in 2007. This sync intentionally stops at
2016 so it cannot overlap the app's existing 2017+ WTA layer. A canonical
match_key is still emitted so future overlapping sources can be deduplicated
before any win/loss aggregation.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests

START_YEAR = 2007
END_YEAR = 2016
BASE = "https://www.tennis-data.co.uk"
OUT_DIR = Path("data/public/tennis-data-wta")
OUT_CSV = OUT_DIR / "wta_matches_2007_2016.csv"
REPORT = OUT_DIR / "DEDUP_REPORT.json"


def clean_text(v: Any) -> str:
    if pd.isna(v):
        return ""
    return re.sub(r"\s+", " ", str(v).strip())


def norm(v: Any) -> str:
    s = clean_text(v).lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def iso_date(v: Any) -> str:
    if pd.isna(v) or clean_text(v) == "":
        return ""
    try:
        return pd.to_datetime(v, dayfirst=True, errors="raise").date().isoformat()
    except Exception:
        return clean_text(v)


def num(v: Any) -> str:
    if pd.isna(v) or clean_text(v) == "":
        return ""
    try:
        x = float(v)
        return str(int(x)) if x.is_integer() else str(x)
    except Exception:
        return clean_text(v)


def season_url(year: int) -> str:
    ext = "xls" if year <= 2012 else "xlsx"
    return f"{BASE}/{year}w/{year}.{ext}"


def download_year(year: int) -> pd.DataFrame:
    url = season_url(year)
    r = requests.get(url, timeout=60, headers={"User-Agent": "TennisTruthEngine/1.0 historical-data-sync"})
    r.raise_for_status()
    suffix = ".xls" if year <= 2012 else ".xlsx"
    temp = OUT_DIR / f".tmp_{year}{suffix}"
    temp.write_bytes(r.content)
    try:
        return pd.read_excel(temp)
    finally:
        temp.unlink(missing_ok=True)


def canonical_match_key(row: dict[str, str]) -> str:
    # Player order is intentionally sorted: the same match must have the same
    # key no matter which upstream source labels the players winner/loser or P1/P2.
    players = sorted([norm(row.get("winner")), norm(row.get("loser"))])
    material = "|".join([
        row.get("date", ""),
        norm(row.get("tournament")),
        norm(row.get("round")),
        players[0] if players else "",
        players[1] if len(players) > 1 else "",
    ])
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:24]


def normalize_row(raw: pd.Series, year: int) -> dict[str, str]:
    # Tennis-Data column names are stable but differ slightly across old files.
    def get(*names: str) -> Any:
        by_lower = {str(k).strip().lower(): v for k, v in raw.items()}
        for name in names:
            if name.lower() in by_lower:
                return by_lower[name.lower()]
        return ""

    row = {
        "season": str(year),
        "date": iso_date(get("Date")),
        "tournament": clean_text(get("Tournament")),
        "location": clean_text(get("Location")),
        "tier": clean_text(get("Tier", "Series")),
        "court": clean_text(get("Court")),
        "surface": clean_text(get("Surface")),
        "round": clean_text(get("Round")),
        "best_of": num(get("Best of", "BestOf")),
        "winner": clean_text(get("Winner")),
        "loser": clean_text(get("Loser")),
        "winner_rank": num(get("WRank")),
        "loser_rank": num(get("LRank")),
        "winner_sets": num(get("Wsets")),
        "loser_sets": num(get("Lsets")),
        "w1": num(get("W1")), "l1": num(get("L1")),
        "w2": num(get("W2")), "l2": num(get("L2")),
        "w3": num(get("W3")), "l3": num(get("L3")),
        "w4": num(get("W4")), "l4": num(get("L4")),
        "w5": num(get("W5")), "l5": num(get("L5")),
        "comment": clean_text(get("Comment")),
        "source": "Tennis-Data.co.uk",
        "source_url": season_url(year),
    }
    row["match_key"] = canonical_match_key(row)
    return row


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    per_year: dict[str, int] = {}
    for year in range(START_YEAR, END_YEAR + 1):
        df = download_year(year)
        normalized = [normalize_row(r, year) for _, r in df.iterrows()]
        normalized = [r for r in normalized if r["winner"] and r["loser"]]
        per_year[str(year)] = len(normalized)
        rows.extend(normalized)

    before = len(rows)
    # Same canonical match can appear only once. Prefer the first exact season row.
    deduped: dict[str, dict[str, str]] = {}
    collisions: list[dict[str, str]] = []
    for row in rows:
        key = row["match_key"]
        if key in deduped:
            prev = deduped[key]
            # If the canonical identity collides but winner differs, do not silently
            # choose one: fail the sync so a human can inspect the upstream conflict.
            if norm(prev["winner"]) != norm(row["winner"]):
                collisions.append({"match_key": key, "first": prev["winner"], "second": row["winner"]})
            continue
        deduped[key] = row

    if collisions:
        print(json.dumps({"conflicting_duplicate_matches": collisions[:20]}, indent=2), file=sys.stderr)
        return 2

    final_rows = sorted(deduped.values(), key=lambda r: (r["date"], r["tournament"], r["round"], r["winner"], r["loser"]))
    columns = [
        "match_key", "season", "date", "tournament", "location", "tier", "court", "surface", "round", "best_of",
        "winner", "loser", "winner_rank", "loser_rank", "winner_sets", "loser_sets",
        "w1", "l1", "w2", "l2", "w3", "l3", "w4", "l4", "w5", "l5", "comment", "source", "source_url",
    ]
    pd.DataFrame(final_rows, columns=columns).to_csv(OUT_CSV, index=False)

    report = {
        "source": "Tennis-Data.co.uk",
        "requested_range": "2005-2016",
        "source_available_range_used": f"{START_YEAR}-{END_YEAR}",
        "note": "Tennis-Data.co.uk WTA archive begins in 2007; 2005-2006 are not fabricated or substituted.",
        "rows_before_dedup": before,
        "rows_after_dedup": len(final_rows),
        "duplicates_removed": before - len(final_rows),
        "conflicting_duplicates": 0,
        "per_year_input_rows": per_year,
        "canonical_key": "sha256(date|normalized tournament|normalized round|sorted normalized player pair)[:24]",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
