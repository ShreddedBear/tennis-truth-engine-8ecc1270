#!/usr/bin/env python3
from __future__ import annotations
import base64, gzip, hashlib, io, json, re, zipfile
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd

YEARS=range(2021,2027)
RAW=Path('data/raw/tennisdata-wta-challenger')
OUT=Path('data/public/tennisdata-wta-challenger')
OUT_CSV=OUT/'wta_challenger_matches_2021_2026.csv'
MANIFEST=OUT/'IMPORT_MANIFEST.json'


def clean(v):
    if pd.isna(v): return ''
    return re.sub(r'\s+',' ',str(v).strip())

def norm(v):
    return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9]+',' ',clean(v).lower())).strip()

def key(row):
    players=sorted([norm(row['home_player']),norm(row['away_player'])])
    material='|'.join([row['date'],norm(row['tournament']),norm(row['round']),*players])
    return hashlib.sha256(material.encode()).hexdigest()[:24]

def decode_gz_b64(path: Path) -> pd.DataFrame:
    raw=base64.b64decode(path.read_text().strip(),validate=True)
    return pd.read_csv(io.BytesIO(gzip.decompress(raw)),low_memory=False)

def decode_zip_b64(path: Path):
    raw=base64.b64decode(path.read_text().strip(),validate=True)
    z=zipfile.ZipFile(io.BytesIO(raw))
    return {int(name[:4]):pd.read_csv(z.open(name),low_memory=False) for name in z.namelist() if name.endswith('.csv')}

def load_years():
    data={}
    for year in (2021,2022):
        p=RAW/f'{year}-wta-challenger-only.csv.gz.b64'
        if not p.exists(): raise RuntimeError(f'missing required verified input {p}')
        data[year]=decode_gz_b64(p)
    p=RAW/'2023-2026-wta-challenger-only.zip.b64'
    if not p.exists(): raise RuntimeError(f'missing required verified input {p}')
    data.update(decode_zip_b64(p))
    missing=[y for y in YEARS if y not in data]
    if missing: raise RuntimeError(f'missing years after decode: {missing}')
    return data

def validate_source(year,df):
    required={'tour_type','tour_type_human','tournament','round','home_name','away_name','winner_code'}
    missing=required-set(df.columns)
    if missing: raise RuntimeError(f'{year}: missing required columns {sorted(missing)}')
    # Absolute contamination firewall: every source row must be TennisData WTA Chall (tour_type=4).
    bad=df[(df['tour_type_human'].astype(str).str.strip()!='WTA Chall') | (pd.to_numeric(df['tour_type'],errors='coerce')!=4)]
    if len(bad):
        raise RuntimeError(f'CONTAMINATION_FIREWALL_BLOCKED {year}: {len(bad)} non-WTA-Chall rows')
    # Main-tour naming must not appear as classification.
    if df['tour_type_human'].astype(str).str.contains('WTA Tour',case=False,na=False).any():
        raise RuntimeError(f'CONTAMINATION_FIREWALL_BLOCKED {year}: WTA Tour row detected')

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    yearly=load_years(); rows=[]; report={}
    for year in YEARS:
        df=yearly[year]
        validate_source(year,df)
        out=pd.DataFrame({
            'season':str(year),
            'date':df.get('date_human','').map(clean) if 'date_human' in df else '',
            'tournament':df['tournament'].map(clean),
            'level':'WTA Chall',
            'classification':'WTA_125_CHALLENGER',
            'classification_evidence':'tour_type_human=WTA Chall; tour_type=4',
            'round':df['round'].map(clean),
            'surface':df.get('surface','').map(clean) if 'surface' in df else '',
            'home_player':df['home_name'].map(clean),
            'away_player':df['away_name'].map(clean),
            'home_player_id':df.get('home_id','').map(clean) if 'home_id' in df else '',
            'away_player_id':df.get('away_id','').map(clean) if 'away_id' in df else '',
            'winner_code':df['winner_code'].map(clean),
            'home_set_score':df.get('home_set_score','').map(clean) if 'home_set_score' in df else '',
            'away_set_score':df.get('away_set_score','').map(clean) if 'away_set_score' in df else '',
            'source':'TennisData.app',
        })
        out=out[(out.home_player!='')&(out.away_player!='')].copy()
        out['match_key']=out.apply(key,axis=1)
        rows.append(out)
        report[str(year)]={'source_rows':len(df),'accepted_wta_challenger_rows':len(out),'rejected_as_main_tour':0}
        print(f'{year}: accepted {len(out)} WTA Challenger rows; contamination=0')
    all_rows=pd.concat(rows,ignore_index=True)
    before=len(all_rows)
    all_rows=all_rows.drop_duplicates('match_key',keep='first')
    # Final firewall after normalization.
    if not (all_rows['classification'].eq('WTA_125_CHALLENGER').all() and all_rows['level'].eq('WTA Chall').all()):
        raise RuntimeError('CONTAMINATION_FIREWALL_BLOCKED final output')
    all_rows.sort_values(['season','date','tournament','round','home_player','away_player']).to_csv(OUT_CSV,index=False)
    manifest={
      'source':'TennisData.app user-supplied season CSVs',
      'scope':'WTA Challenger / WTA 125 ONLY',
      'years':report,
      'rows_before_dedup':before,
      'rows_after_dedup':len(all_rows),
      'duplicates_removed':before-len(all_rows),
      'main_tour_rows_integrated':0,
      'contamination_firewall':'PASS',
      'source_gate':'tour_type_human must equal WTA Chall AND tour_type must equal 4',
      'generated_at_utc':datetime.now(timezone.utc).isoformat()
    }
    MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(manifest,indent=2))

if __name__=='__main__': main()
