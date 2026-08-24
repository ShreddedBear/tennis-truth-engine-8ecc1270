#!/usr/bin/env python3
from __future__ import annotations
import base64, gzip, hashlib, io, json, lzma, re
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

def _decode_b64_text(text:str)->bytes:
    s=''.join(text.split())
    s += '='*((4-len(s)%4)%4)
    return base64.b64decode(s,validate=True)

def _parts(pattern:str):
    parts=sorted(RAW.glob(pattern))
    if not parts: raise RuntimeError(f'missing required compact input: {pattern}')
    return parts

def _decompress(raw:bytes,kind:str)->bytes:
    return gzip.decompress(raw) if kind=='gz' else lzma.decompress(raw)

def _load_encoded_csv(year:int,kind:str,pattern:str)->pd.DataFrame:
    parts=_parts(pattern)
    texts=[p.read_text().strip() for p in parts]
    print(f'{year}: loading {len(parts)} input part(s): {[p.name for p in parts]}')

    # Strategy A: parts are slices of one base64 stream.
    joined=''.join(texts)
    try:
        raw=_decode_b64_text(joined)
        csv_bytes=_decompress(raw,kind)
        print(f'{year}: decoded using joined-base64 strategy')
        return pd.read_csv(io.BytesIO(csv_bytes),low_memory=False)
    except Exception as joined_exc:
        print(f'{year}: joined-base64 strategy failed: {type(joined_exc).__name__}: {joined_exc}')

    # Strategy B: each part was base64-encoded independently after binary chunking.
    # Decode each part separately, concatenate the binary chunks, then decompress once.
    try:
        raw=b''.join(_decode_b64_text(t) for t in texts)
        csv_bytes=_decompress(raw,kind)
        print(f'{year}: decoded using per-part-base64 strategy')
        return pd.read_csv(io.BytesIO(csv_bytes),low_memory=False)
    except Exception as part_exc:
        lengths=[len(''.join(t.split())) for t in texts]
        raise RuntimeError(
            f'{year}: encoded input is unreadable; pattern={pattern}; '
            f'base64_char_lengths={lengths}; '
            f'per-part error={type(part_exc).__name__}: {part_exc}'
        ) from part_exc

def load_years():
    specs={
      2021:('gz','2021-compact.csv.gz.b64'),
      2022:('gz','2022-compact.csv.gz.b64'),
      2023:('gz','2023-compact.csv.gz.b64'),
      2024:('xz','2024-v2.csv.xz.b64.part*'),
      2025:('xz','2025-v2.csv.xz.b64.part*'),
      2026:('xz','2026-v2.csv.xz.b64.part*'),
    }
    data={}
    for year,(kind,pattern) in specs.items():
        data[year]=_load_encoded_csv(year,kind,pattern)
    return data

def validate_source(year,df):
    required={'tour_type','tour_type_human','tournament','round','home_name','away_name','winner_code'}
    missing=required-set(df.columns)
    if missing: raise RuntimeError(f'{year}: missing required columns {sorted(missing)}')
    human=df['tour_type_human'].astype(str).str.strip()
    num=pd.to_numeric(df['tour_type'],errors='coerce')
    bad=df[(human!='WTA Chall') | (num!=4)]
    if len(bad): raise RuntimeError(f'CONTAMINATION_FIREWALL_BLOCKED {year}: {len(bad)} non-WTA-Chall rows')
    if human.str.contains('WTA Tour',case=False,na=False).any():
        raise RuntimeError(f'CONTAMINATION_FIREWALL_BLOCKED {year}: WTA Tour row detected')

def col(df,name):
    return df[name].map(clean) if name in df.columns else pd.Series(['']*len(df),index=df.index)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    yearly=load_years(); rows=[]; report={}
    for year in YEARS:
        df=yearly[year]
        validate_source(year,df)
        out=pd.DataFrame({
            'season':str(year),'date':col(df,'date_human'),'tournament':col(df,'tournament'),
            'level':'WTA Chall','classification':'WTA_125_CHALLENGER',
            'classification_evidence':'tour_type_human=WTA Chall; tour_type=4',
            'round':col(df,'round'),'surface':col(df,'surface'),'home_player':col(df,'home_name'),
            'away_player':col(df,'away_name'),'home_player_id':col(df,'home_id'),'away_player_id':col(df,'away_id'),
            'winner_code':col(df,'winner_code'),'home_set_score':col(df,'home_set_score'),
            'away_set_score':col(df,'away_set_score'),'source':'TennisData.app'})
        out=out[(out.home_player!='')&(out.away_player!='')].copy()
        out['match_key']=out.apply(key,axis=1)
        rows.append(out)
        report[str(year)]={'source_rows':len(df),'accepted_wta_challenger_rows':len(out),'rejected_as_main_tour':0}
        print(f'{year}: accepted {len(out)} WTA Challenger rows; contamination=0')
    all_rows=pd.concat(rows,ignore_index=True)
    before=len(all_rows)
    all_rows=all_rows.drop_duplicates('match_key',keep='first')
    if not (all_rows['classification'].eq('WTA_125_CHALLENGER').all() and all_rows['level'].eq('WTA Chall').all()):
        raise RuntimeError('CONTAMINATION_FIREWALL_BLOCKED final output')
    all_rows.sort_values(['season','date','tournament','round','home_player','away_player']).to_csv(OUT_CSV,index=False)
    manifest={'source':'TennisData.app user-supplied season CSVs','scope':'WTA Challenger / WTA 125 ONLY','years':report,
      'rows_before_dedup':before,'rows_after_dedup':len(all_rows),'duplicates_removed':before-len(all_rows),
      'main_tour_rows_integrated':0,'contamination_firewall':'PASS',
      'source_gate':'tour_type_human must equal WTA Chall AND tour_type must equal 4',
      'generated_at_utc':datetime.now(timezone.utc).isoformat()}
    MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(manifest,indent=2))

if __name__=='__main__': main()
