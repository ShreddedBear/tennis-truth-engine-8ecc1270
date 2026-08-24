#!/usr/bin/env python3
"""Sync TennisData.app WTA Challenger / WTA 125 matches for 2021-2026.

The public TennisData.app season files contain both WTA main-tour and Challenger
matches. This importer downloads each WTA season, identifies Challenger/WTA 125
rows from the source's tour/tournament-level fields, normalizes them, and writes
one canonical CSV plus an audit manifest.

No main-tour rows are intentionally imported by this script.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import pandas as pd
import requests

START_YEAR = 2021
END_YEAR = 2026
DOWNLOADS_PAGE = "https://tennisdata.app/downloads/"
OUT_DIR = Path("data/public/tennisdata-wta-challenger")
OUT_CSV = OUT_DIR / "wta_challenger_matches_2021_2026.csv"
MANIFEST = OUT_DIR / "IMPORT_MANIFEST.json"
UA = "TennisTruthEngine/1.0 WTA-Challenger-history-sync"


def clean(v) -> str:
    if pd.isna(v):
        return ""
    return re.sub(r"\s+", " ", str(v).strip())


def norm(v) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(v).lower())).strip()


def get_col(row: pd.Series, *names: str):
    cols = {norm(k).replace(" ", "_"): v for k, v in row.items()}
    for name in names:
        key = norm(name).replace(" ", "_")
        if key in cols:
            return cols[key]
    return ""


def discover_url(year: int, session: requests.Session) -> str:
    """Find the public WTA season CSV URL without hard-coding private endpoints.

    Optional TENNISDATA_WTA_URL_TEMPLATE may be set if TennisData.app changes the
    downloads page. Example template: https://host/path/{year}-wta-season.csv
    """
    template = os.getenv("TENNISDATA_WTA_URL_TEMPLATE", "").strip()
    if template:
        return template.format(year=year)

    r = session.get(DOWNLOADS_PAGE, timeout=60)
    r.raise_for_status()
    filename = f"{year}-wta-season.csv"
    # Search normal hrefs and any JS/JSON strings containing the public filename.
    candidates = re.findall(r'''(?:href|url|download)\s*[=:]\s*["']([^"']+)["']''', r.text, flags=re.I)
    candidates += re.findall(r'''["']([^"']*%s[^"']*)["']''' % re.escape(filename), r.text, flags=re.I)
    for c in candidates:
        c = c.replace("\\/", "/")
        if filename.lower() in c.lower():
            return urljoin(DOWNLOADS_PAGE, c)

    # TennisData.app documents the exact public filename. These conventional
    # same-origin paths are attempted only when the page does not expose hrefs.
    for path in (f"/downloads/{filename}", f"/data/{filename}", f"/{filename}"):
        u = urljoin(DOWNLOADS_PAGE, path)
        h = session.head(u, timeout=30, allow_redirects=True)
        if h.ok and "text/html" not in h.headers.get("content-type", "").lower():
            return u

    raise RuntimeError(
        f"Could not discover public TennisData.app file {filename}. "
        "Set repository secret TENNISDATA_WTA_URL_TEMPLATE to the public URL template if the site changed its download mechanism."
    )


def download_csv(year: int, session: requests.Session) -> tuple[str, pd.DataFrame]:
    url = discover_url(year, session)
    r = session.get(url, timeout=120, allow_redirects=True)
    r.raise_for_status()
    if "text/html" in r.headers.get("content-type", "").lower():
        raise RuntimeError(f"Expected CSV for {year}, received HTML from {url}")
    return url, pd.read_csv(io.BytesIO(r.content), low_memory=False)


def is_wta_challenger(row: pd.Series) -> bool:
    """Conservative WTA Challenger/WTA 125 classifier.

    TennisData.app says season files include main tour + Challengers. We require
    an explicit Challenger/125 signal in level/tour/category/tournament fields;
    ambiguous rows are excluded rather than guessed.
    """
    fields = [
        get_col(row, "tour_type", "tour", "level", "tournament_level", "category", "series"),
        get_col(row, "tournament", "tournament_name", "event", "event_name"),
    ]
    blob = " ".join(norm(x) for x in fields)
    positive = ("challenger", "chall ", "chall.", "wta 125", "125k", "125")
    return any(token in blob for token in positive)


def canonical_key(d: dict[str, str]) -> str:
    players = sorted([norm(d.get("home_player")), norm(d.get("away_player"))])
    raw = "|".join([
        d.get("date", ""), norm(d.get("tournament")), norm(d.get("round")),
        players[0] if players else "", players[1] if len(players) > 1 else "",
    ])
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def normalize_row(row: pd.Series, year: int, source_url: str) -> dict[str, str]:
    def s(*names): return clean(get_col(row, *names))
    out = {
        "season": str(year),
        "date": s("date", "match_date", "start_date"),
        "tournament": s("tournament", "tournament_name", "event", "event_name"),
        "level": s("tour_type", "tour", "level", "tournament_level", "category", "series"),
        "round": s("round", "round_name"),
        "surface": s("surface", "court_surface"),
        "home_player": s("home_player", "home_name", "player_home", "player1", "player_1"),
        "away_player": s("away_player", "away_name", "player_away", "player2", "player_2"),
        "home_player_id": s("home_player_id", "home_id", "player1_id", "player_1_id"),
        "away_player_id": s("away_player_id", "away_id", "player2_id", "player_2_id"),
        "winner_code": s("winner_code", "winner"),
        "score": s("score", "final_score"),
        "source": "TennisData.app",
        "source_url": source_url,
    }
    out["match_key"] = canonical_key(out)
    return out


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept": "text/csv,text/plain,*/*"})

    all_rows: list[dict[str, str]] = []
    audit: dict[str, object] = {
        "source": "TennisData.app",
        "requested_years": [START_YEAR, END_YEAR],
        "scope": "WTA Challenger / WTA 125 only",
        "source_statement": "Public WTA season files include main-tour and Challenger matches; seasons 2021-2026.",
        "years": {},
    }

    for year in range(START_YEAR, END_YEAR + 1):
        url, df = download_csv(year, session)
        selected = df[df.apply(is_wta_challenger, axis=1)].copy()
        normalized = [normalize_row(r, year, url) for _, r in selected.iterrows()]
        normalized = [r for r in normalized if r["home_player"] and r["away_player"]]
        all_rows.extend(normalized)
        audit["years"][str(year)] = {
            "source_url": url,
            "source_rows": int(len(df)),
            "challenger_rows_selected": int(len(selected)),
            "usable_rows": len(normalized),
        }
        print(f"{year}: source={len(df)} challenger={len(selected)} usable={len(normalized)}")

    dedup: dict[str, dict[str, str]] = {}
    duplicates = 0
    conflicts = []
    for row in all_rows:
        k = row["match_key"]
        if k in dedup:
            duplicates += 1
            if dedup[k].get("winner_code") != row.get("winner_code"):
                conflicts.append(k)
            continue
        dedup[k] = row

    if conflicts:
        print(json.dumps({"conflicting_duplicate_keys": conflicts[:50]}, indent=2), file=sys.stderr)
        return 2

    rows = sorted(dedup.values(), key=lambda r: (r["season"], r["date"], r["tournament"], r["round"], r["home_player"], r["away_player"]))
    columns = ["match_key", "season", "date", "tournament", "level", "round", "surface", "home_player", "away_player", "home_player_id", "away_player_id", "winner_code", "score", "source", "source_url"]
    pd.DataFrame(rows, columns=columns).to_csv(OUT_CSV, index=False)

    audit.update({
        "rows_before_dedup": len(all_rows),
        "rows_after_dedup": len(rows),
        "duplicates_removed": duplicates,
        "conflicting_duplicates": 0,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "classifier_policy": "Explicit Challenger/WTA 125 signal required; ambiguous rows excluded.",
    })
    MANIFEST.write_text(json.dumps(audit, indent=2) + "\n")
    print(json.dumps(audit, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
