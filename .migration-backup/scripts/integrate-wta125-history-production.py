#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

SRC = Path('data/public/tennisdata-wta-challenger/wta_challenger_matches_2021_2026.csv')
OUT_DIR = Path('data/public/production-history/wta_challenger')
OUT = OUT_DIR / 'matches_2021_2026.csv'
MANIFEST = OUT_DIR / 'INTEGRATION_MANIFEST.json'
EXPECTED = {'2021': 540, '2022': 881, '2023': 1096, '2024': 1374, '2025': 2092, '2026': 1632}
EXPECTED_TOTAL = sum(EXPECTED.values())


def fail(msg: str):
    raise SystemExit(msg)


def main():
    if not SRC.exists() or SRC.stat().st_size == 0:
        fail(f'missing validated source: {SRC}')

    df = pd.read_csv(SRC, dtype=str, keep_default_na=False)
    required = {
        'season','date','tournament','level','classification','round','surface',
        'home_player','away_player','home_player_id','away_player_id','winner_code',
        'home_set_score','away_set_score','source','match_key'
    }
    missing = required - set(df.columns)
    if missing:
        fail(f'missing required source columns: {sorted(missing)}')

    # Hard tour firewall. Nothing except explicit WTA Challenger / WTA 125 survives.
    bad = df[(df['classification'] != 'WTA_125_CHALLENGER') | (df['level'] != 'WTA Chall')]
    if len(bad):
        fail(f'CONTAMINATION_FIREWALL_BLOCKED: {len(bad)} non-WTA-125 rows detected')

    forbidden = ('ATP', 'WTA_MAIN', 'WTA Main', 'WTA Tour', 'WTA 250', 'WTA 500', 'WTA 1000', 'Grand Slam')
    check_cols = ['classification','level']
    for col in check_cols:
        vals = df[col].astype(str)
        if any(vals.str.contains(x, case=False, regex=False).any() for x in forbidden):
            fail(f'CONTAMINATION_FIREWALL_BLOCKED: forbidden tour label in {col}')

    counts = Counter(df['season'].astype(str))
    got = {y: counts.get(y, 0) for y in EXPECTED}
    if got != EXPECTED:
        fail(f'year coverage mismatch: expected={EXPECTED} got={got}')
    if len(df) != EXPECTED_TOTAL:
        fail(f'row-count mismatch: expected={EXPECTED_TOTAL} got={len(df)}')

    dup_keys = int(df['match_key'].duplicated().sum())
    if dup_keys:
        fail(f'duplicate match_key values detected: {dup_keys}')

    # Production-facing immutable classification fields.
    out = df.copy()
    out.insert(0, 'tour_family', 'WTA_CHALLENGER')
    out.insert(1, 'competition_level', 'WTA_125')
    out.insert(2, 'production_scope', 'WTA_125_ONLY')
    out.insert(3, 'contamination_firewall', 'PASS')
    out.insert(4, 'historical_source_status', 'VALIDATED_SOURCE')

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False)

    manifest = {
        'state': 'SUCCESS',
        'scope': 'WTA Challenger / WTA 125 ONLY',
        'source': str(SRC),
        'output': str(OUT),
        'years': EXPECTED,
        'rows_integrated': len(out),
        'duplicate_keys': 0,
        'wta_main_rows_integrated': 0,
        'atp_rows_integrated': 0,
        'atp_challenger_rows_integrated': 0,
        'contamination_firewall': 'PASS',
        'production_tour_family': 'WTA_CHALLENGER',
        'production_competition_level': 'WTA_125',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
