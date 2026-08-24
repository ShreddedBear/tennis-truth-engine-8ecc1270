#!/usr/bin/env python3
"""Sync TennisData.app WTA Challenger / WTA 125 matches for 2021-2026.

This importer is contamination-safe by design:
- It prefers local TennisData.app season CSVs in data/raw/tennisdata-wta/.
- It imports ONLY rows with an explicit WTA 125 / Challenger classification.
- It rejects known WTA main-tour levels and ambiguous rows.
- It performs a second output firewall and aborts before writing if any row is
  not positively classified as WTA 125 / Challenger.

No regular WTA main-tour row is allowed into the canonical output.
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
RAW_DIR = Path("data/raw/tennisdata-wta")
OUT_DIR = Path("data/public/tennisdata-wta-challenger")
OUT_CSV = OUT_DIR / "wta_challenger_matches_2021_2026.csv"
MANIFEST = OUT_DIR / "IMPORT_MANIFEST.json"
REJECTED_CSV = OUT_DIR / "REJECTED_NON_CHALLENGER_ROWS.csv"
UA = "TennisTruthEngine/1.0 WTA-Challenger-history-sync"

POSITIVE_LEVEL_PATTERNS = (
    r"\bwta\s*125\b",
    r"\bwta\s*125k\b",
    r"\b125k\b",
    r"\bchallenger\b",
    r"\bwta\s*challenger\b",
)

# Explicit main-tour signals. Any one of these is a hard rejection unless the
# same row also has an explicit WTA 125/Challenger level field.
MAIN_TOUR_PATTERNS = (
    r"\bwta\s*1000\b",
    r"\bwta\s*500\b",
    r"\bwta\s*250\b",
    r"\bpremier\b",
    r"\bpremier\s*mandatory\b",
    r"\bpremier\s*5\b",
    r"\binternational\b",
    r"\bgrand\s*slam\b",
    r"\bslam\b",
    r"\bwta\s*finals\b",
    r"\bolympics?\b",
    r"\bfed\s*cup\b",
    r"\bbillie\s*jean\s*king\s*cup\b",
)

LEVEL_COLUMNS = (
    "tour_type", "tour", "level", "tournament_level", "category", "series",
    "event_level", "tournament_category", "tier",
)
TOURNAMENT_COLUMNS = ("tournament", "tournament_name", "event", "event_name")


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


def has_pattern(text: str, patterns: tuple[str, ...]) -> bool:
    return any(re.search(p, text, flags=re.I) for p in patterns)


def classification_evidence(row: pd.Series) -> dict[str, str | bool]:
    level_values = [clean(get_col(row, name)) for name in LEVEL_COLUMNS]
    level_values = [v for v in level_values if v]
    tournament_values = [clean(get_col(row, name)) for name in TOURNAMENT_COLUMNS]
    tournament_values = [v for v in tournament_values if v]

    level_blob = " | ".join(level_values)
    tournament_blob = " | ".join(tournament_values)
    all_blob = " | ".join(level_values + tournament_values)

    explicit_positive_level = has_pattern(level_blob, POSITIVE_LEVEL_PATTERNS)
    any_positive = has_pattern(all_blob, POSITIVE_LEVEL_PATTERNS)
    explicit_main = has_pattern(all_blob, MAIN_TOUR_PATTERNS)

    # Safest policy: a row is accepted only with an explicit positive signal.
    # If it also looks main-tour, only an explicit positive LEVEL field can
    # rescue it; tournament-name text alone is never enough.
    accepted = bool(any_positive and (not explicit_main or explicit_positive_level))

    if accepted:
        reason = "EXPLICIT_WTA_125_OR_CHALLENGER"
    elif explicit_main:
        reason = "REJECT_MAIN_TOUR_SIGNAL"
    else:
        reason = "REJECT_AMBIGUOUS_NO_EXPLICIT_125_SIGNAL"

    return {
        "accepted": accepted,
        "reason": reason,
        "level_evidence": level_blob,
        "tournament_evidence": tournament_blob,
    }


def local_csv(year: int) -> Path | None:
    candidates = [
        RAW_DIR / f"{year}-wta-season.csv",
        RAW_DIR / f"{year}_wta_season.csv",
        RAW_DIR / f"wta-{year}.csv",
        RAW_DIR / f"wta_{year}.csv",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def discover_url(year: int, session: requests.Session) -> str:
    template = os.getenv("TENNISDATA_WTA_URL_TEMPLATE", "").strip()
    if template:
        return template.format(year=year)

    r = session.get(DOWNLOADS_PAGE, timeout=60)
    r.raise_for_status()
    filename = f"{year}-wta-season.csv"
    candidates = re.findall(r'''(?:href|url|download)\s*[=:]\s*["']([^"']+)["']''', r.text, flags=re.I)
    candidates += re.findall(r'''["']([^"']*%s[^"']*)["']''' % re.escape(filename), r.text, flags=re.I)
    for c in candidates:
        c = c.replace("\\/", "/")
        if filename.lower() in c.lower():
            return urljoin(DOWNLOADS_PAGE, c)

    raise RuntimeError(
        f"No local TennisData.app CSV found for {year} and public URL discovery failed. "
        f"Place {year}-wta-season.csv in {RAW_DIR}/ or set TENNISDATA_WTA_URL_TEMPLATE."
    )


def load_year(year: int, session: requests.Session) -> tuple[str, pd.DataFrame]:
    p = local_csv(year)
    if p:
        return f"local:{p.as_posix()}", pd.read_csv(p, low_memory=False)

    url = discover_url(year, session)
    r = session.get(url, timeout=120, allow_redirects=True)
    r.raise_for_status()
    if "text/html" in r.headers.get("content-type", "").lower():
        raise RuntimeError(f"Expected CSV for {year}, received HTML from {url}")
    return url, pd.read_csv(io.BytesIO(r.content), low_memory=False)


def canonical_key(d: dict[str, str]) -> str:
    players = sorted([norm(d.get("home_player")), norm(d.get("away_player"))])
    raw = "|".join([
        d.get("date", ""), norm(d.get("tournament")), norm(d.get("round")),
        players[0] if players else "", players[1] if len(players) > 1 else "",
    ])
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def normalize_row(row: pd.Series, year: int, source_url: str, evidence: dict[str, str | bool]) -> dict[str, str]:
    def s(*names): return clean(get_col(row, *names))
    out = {
        "season": str(year),
        "date": s("date", "match_date", "start_date"),
        "tournament": s(*TOURNAMENT_COLUMNS),
        "level": s(*LEVEL_COLUMNS),
        "classification": "WTA_125_CHALLENGER",
        "classification_reason": str(evidence["reason"]),
        "classification_evidence": str(evidence["level_evidence"] or evidence["tournament_evidence"]),
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


def output_firewall(rows: list[dict[str, str]]) -> None:
    bad = []
    for r in rows:
        if r.get("classification") != "WTA_125_CHALLENGER":
            bad.append((r.get("match_key"), "missing classification"))
            continue
        evidence = norm(r.get("classification_evidence"))
        if not has_pattern(evidence, POSITIVE_LEVEL_PATTERNS):
            bad.append((r.get("match_key"), "no positive WTA125/Challenger evidence"))
            continue
        # Absolute firewall: explicit main-tour labels are forbidden unless the
        # classification evidence itself also explicitly says WTA125/Challenger.
        combined = norm(" ".join([r.get("level", ""), r.get("tournament", "")]))
        if has_pattern(combined, MAIN_TOUR_PATTERNS) and not has_pattern(evidence, POSITIVE_LEVEL_PATTERNS):
            bad.append((r.get("match_key"), "main-tour contamination signal"))

    if bad:
        raise RuntimeError(f"CONTAMINATION_FIREWALL_BLOCKED {len(bad)} rows; examples={bad[:20]}")


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept": "text/csv,text/plain,*/*"})

    all_rows: list[dict[str, str]] = []
    rejected_rows: list[dict[str, str]] = []
    audit: dict[str, object] = {
        "source": "TennisData.app",
        "requested_years": [START_YEAR, END_YEAR],
        "scope": "WTA Challenger / WTA 125 ONLY",
        "contamination_policy": "Fail closed. Explicit WTA125/Challenger evidence required. Main-tour and ambiguous rows are rejected.",
        "years": {},
    }

    for year in range(START_YEAR, END_YEAR + 1):
        source, df = load_year(year, session)
        accepted = []
        rejected = []
        for idx, row in df.iterrows():
            ev = classification_evidence(row)
            if ev["accepted"]:
                accepted.append((row, ev))
            else:
                rejected.append({
                    "season": str(year),
                    "row_index": str(idx),
                    "reason": str(ev["reason"]),
                    "level_evidence": str(ev["level_evidence"]),
                    "tournament_evidence": str(ev["tournament_evidence"]),
                })

        normalized = [normalize_row(r, year, source, ev) for r, ev in accepted]
        normalized = [r for r in normalized if r["home_player"] and r["away_player"]]
        all_rows.extend(normalized)
        rejected_rows.extend(rejected)

        audit["years"][str(year)] = {
            "source": source,
            "source_rows": int(len(df)),
            "accepted_wta125_rows": len(normalized),
            "rejected_non_wta125_rows": len(rejected),
        }
        print(f"{year}: source={len(df)} accepted_wta125={len(normalized)} rejected={len(rejected)}")

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

    # SECOND PASS / FAIL-CLOSED contamination safeguard.
    output_firewall(rows)

    columns = [
        "match_key", "season", "date", "tournament", "level", "classification",
        "classification_reason", "classification_evidence", "round", "surface",
        "home_player", "away_player", "home_player_id", "away_player_id",
        "winner_code", "score", "source", "source_url",
    ]
    pd.DataFrame(rows, columns=columns).to_csv(OUT_CSV, index=False)
    pd.DataFrame(rejected_rows).to_csv(REJECTED_CSV, index=False)

    audit.update({
        "rows_before_dedup": len(all_rows),
        "rows_after_dedup": len(rows),
        "duplicates_removed": duplicates,
        "conflicting_duplicates": 0,
        "rejected_rows_total": len(rejected_rows),
        "main_tour_rows_integrated": 0,
        "contamination_firewall": "PASS",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    })
    MANIFEST.write_text(json.dumps(audit, indent=2) + "\n")
    print(json.dumps(audit, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
