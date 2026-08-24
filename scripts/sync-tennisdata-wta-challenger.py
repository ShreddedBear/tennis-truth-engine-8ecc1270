#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

YEARS = range(2021, 2027)
RAW = Path('data/raw/tennisdata-wta-challenger/direct')
OUT = Path('data/public/tennisdata-wta-challenger')
OUT_CSV = OUT / 'wta_challenger_matches_2021_2026.csv'
MANIFEST = OUT / 'IMPORT_MANIFEST.json'


def clean(v):
    if pd.isna(v):
        return ''
    return re.sub(r'\s+', ' ', str(v).strip())


def norm(v):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', clean(v).lower())).strip()


def key(row):
    players = sorted([norm(row['home_player']), norm(row['away_player'])])
    material = '|'.join([row['date'], norm(row['tournament']), norm(row['round']), *players])
    return hashlib.sha256(material.encode()).hexdigest()[:24]


def source_file(year: int) -> Path:
    return RAW / f'{year}-wta-challenger.csv'


def load_year(year: int) -> pd.DataFrame:
    path = source_file(year)
    if not path.is_file() or path.stat().st_size == 0:
        raise RuntimeError(f'MISSING_DIRECT_CSV {year}: {path}')
    try:
        return pd.read_csv(path, low_memory=False)
    except Exception as exc:
        raise RuntimeError(f'INVALID_DIRECT_CSV {year}: {exc}') from exc


def validate_source(year, df):
    required = {'tour_type', 'tour_type_human', 'tournament', 'round', 'home_name', 'away_name', 'winner_code'}
    missing = required - set(df.columns)
    if missing:
        raise RuntimeError(f'{year}: missing required columns {sorted(missing)}')

    human = df['tour_type_human'].astype(str).str.strip()
    num = pd.to_numeric(df['tour_type'], errors='coerce')

    # Fail closed: every accepted row must explicitly prove WTA Challenger / WTA 125.
    bad = df[(human != 'WTA Chall') | (num != 4)]
    if len(bad):
        raise RuntimeError(
            f'CONTAMINATION_FIREWALL_BLOCKED {year}: '
            f'{len(bad)} rows are not explicit WTA Chall / tour_type=4'
        )

    if human.str.contains('WTA Tour|WTA 250|WTA 500|WTA 1000|Grand Slam', case=False, na=False, regex=True).any():
        raise RuntimeError(f'CONTAMINATION_FIREWALL_BLOCKED {year}: main-tour label detected')


def col(df, name):
    return df[name].map(clean) if name in df.columns else pd.Series([''] * len(df), index=df.index)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    report = {}

    for year in YEARS:
        df = load_year(year)
        validate_source(year, df)

        out = pd.DataFrame({
            'season': str(year),
            'date': col(df, 'date_human'),
            'tournament': col(df, 'tournament'),
            'level': 'WTA Chall',
            'classification': 'WTA_125_CHALLENGER',
            'classification_evidence': 'tour_type_human=WTA Chall; tour_type=4',
            'round': col(df, 'round'),
            'surface': col(df, 'surface'),
            'home_player': col(df, 'home_name'),
            'away_player': col(df, 'away_name'),
            'home_player_id': col(df, 'home_id'),
            'away_player_id': col(df, 'away_id'),
            'winner_code': col(df, 'winner_code'),
            'home_set_score': col(df, 'home_set_score'),
            'away_set_score': col(df, 'away_set_score'),
            'source': 'TennisData.app',
        })

        out = out[(out.home_player != '') & (out.away_player != '')].copy()
        out['match_key'] = out.apply(key, axis=1)
        rows.append(out)

        report[str(year)] = {
            'source_rows': len(df),
            'accepted_wta_challenger_rows': len(out),
            'rejected_as_main_tour': 0,
            'source_file': str(source_file(year)),
        }
        print(f'{year}: accepted {len(out)} WTA Challenger rows; contamination=0')

    all_rows = pd.concat(rows, ignore_index=True)
    before = len(all_rows)
    all_rows = all_rows.drop_duplicates('match_key', keep='first')

    if not (
        all_rows['classification'].eq('WTA_125_CHALLENGER').all()
        and all_rows['level'].eq('WTA Chall').all()
    ):
        raise RuntimeError('CONTAMINATION_FIREWALL_BLOCKED final output')

    all_rows.sort_values(
        ['season', 'date', 'tournament', 'round', 'home_player', 'away_player']
    ).to_csv(OUT_CSV, index=False)

    manifest = {
        'source': 'TennisData.app user-supplied season CSVs',
        'scope': 'WTA Challenger / WTA 125 ONLY',
        'input_transport': 'DIRECT_PLAIN_CSV',
        'years': report,
        'rows_before_dedup': before,
        'rows_after_dedup': len(all_rows),
        'duplicates_removed': before - len(all_rows),
        'main_tour_rows_integrated': 0,
        'contamination_firewall': 'PASS',
        'source_gate': 'tour_type_human must equal WTA Chall AND tour_type must equal 4',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
