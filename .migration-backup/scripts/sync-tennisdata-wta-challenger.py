#!/usr/bin/env python3
from __future__ import annotations
import base64, hashlib, io, json, lzma
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd

RAW=Path('data/raw/tennisdata-wta-challenger/direct-normalized')
OUT=Path('data/public/tennisdata-wta-challenger')
OUT_CSV=OUT/'wta_challenger_matches_2021_2026.csv'
MANIFEST_OUT=OUT/'IMPORT_MANIFEST.json'
EXPECTED={2021:540,2022:881,2023:1096,2024:1374,2025:2092,2026:1632}
EXPECTED_TOTAL=7615
EXPECTED_GATE='tour_type_human == WTA Chall AND tour_type == 4'

def sha(b:bytes)->str: return hashlib.sha256(b).hexdigest()
def load_json(name): return json.loads((RAW/name).read_text())

def load_bundle():
    b=load_json('BUNDLE_MANIFEST.json')
    chunks=[]
    for spec in b['parts']:
        p=RAW/spec['file']
        if not p.is_file(): raise RuntimeError(f'MISSING_BUNDLE_PART {p}')
        text=''.join(p.read_text().split())
        if len(text)!=spec['b64_chars']: raise RuntimeError(f'B64_LENGTH_MISMATCH {p.name}: {len(text)} != {spec["b64_chars"]}')
        try: raw=base64.b64decode(text,validate=True)
        except Exception as e: raise RuntimeError(f'INVALID_BASE64 {p.name}: {e}') from e
        if len(raw)!=spec['decoded_bytes']: raise RuntimeError(f'DECODED_LENGTH_MISMATCH {p.name}')
        if sha(raw)!=spec['sha256']: raise RuntimeError(f'PART_HASH_MISMATCH {p.name}')
        chunks.append(raw)
    compressed=b''.join(chunks)
    if len(compressed)!=b['compressed_bytes'] or sha(compressed)!=b['compressed_sha256']:
        raise RuntimeError('COMPRESSED_BUNDLE_INTEGRITY_FAILURE')
    csv_bytes=lzma.decompress(compressed)
    if len(csv_bytes)!=b['source_bytes'] or sha(csv_bytes)!=b['source_csv_sha256']:
        raise RuntimeError('SOURCE_CSV_INTEGRITY_FAILURE')
    return pd.read_csv(io.BytesIO(csv_bytes)), b

def load_lookup(glob_pattern,idcol,namecol):
    files=sorted(RAW.glob(glob_pattern))
    if not files: raise RuntimeError(f'MISSING_LOOKUP {glob_pattern}')
    df=pd.concat([pd.read_csv(p) for p in files],ignore_index=True)
    conflict=df.groupby(idcol)[namecol].nunique(dropna=False)
    bad=conflict[conflict>1]
    if len(bad): raise RuntimeError(f'CONFLICTING_LOOKUP_IDS {glob_pattern}: {bad.index.tolist()[:10]}')
    return dict(zip(df[idcol].astype(int),df[namecol].astype(str)))

def match_key(r):
    s=f"{int(r.y)}|{int(r.d)}|{int(r.e)}|{int(r.r)}|{int(r.s)}|{int(r.h)}|{int(r.a)}"
    return hashlib.sha256(s.encode()).hexdigest()[:24]

def main():
    src=load_json('SOURCE_MANIFEST.json')
    if src.get('scope')!='WTA Challenger / WTA 125 ONLY': raise RuntimeError('BAD_SOURCE_SCOPE')
    if src.get('source_gate')!=EXPECTED_GATE: raise RuntimeError('BAD_SOURCE_GATE')
    if src.get('expected_rows')!=EXPECTED_TOTAL: raise RuntimeError('BAD_EXPECTED_TOTAL')
    if src.get('main_tour_rows_integrated')!=0: raise RuntimeError('SOURCE_MANIFEST_CONTAMINATION')
    src_counts={int(y):int(v['rows']) for y,v in src['source_files'].items()}
    if src_counts!=EXPECTED: raise RuntimeError(f'BAD_SOURCE_YEAR_COUNTS {src_counts}')

    df,bundle=load_bundle()
    req={'y','d','e','r','s','h','a','w','hs','as','tt'}
    if set(df.columns)!=req: raise RuntimeError(f'BAD_COLUMNS {list(df.columns)}')
    critical=['y','d','e','r','s','h','a','tt']
    if df[critical].isna().any().any(): raise RuntimeError('NULL_CRITICAL_IDENTITY')
    for c in critical: df[c]=pd.to_numeric(df[c],errors='raise').astype(int)
    if not df['tt'].eq(4).all(): raise RuntimeError('CONTAMINATION_FIREWALL_BLOCKED tt!=4')
    if len(df)!=EXPECTED_TOTAL: raise RuntimeError(f'ROW_COUNT_MISMATCH {len(df)}')
    counts=df.groupby('y').size().to_dict()
    if counts!=EXPECTED: raise RuntimeError(f'YEAR_COUNT_MISMATCH {counts}')

    events=pd.read_csv(RAW/'events.csv')
    if events['event_id'].duplicated().any(): raise RuntimeError('DUPLICATE_EVENT_ID')
    event_map=dict(zip(events.event_id.astype(int),events.tournament.astype(str)))
    players=load_lookup('players-part*.csv','player_id','name')
    if not set(df.e).issubset(event_map): raise RuntimeError(f'UNRESOLVED_EVENT_IDS {sorted(set(df.e)-set(event_map))[:10]}')
    unresolved=(set(df.h)|set(df.a))-set(players)
    if unresolved: raise RuntimeError(f'UNRESOLVED_PLAYER_IDS {sorted(unresolved)[:10]}')

    round_map={int(k):v for k,v in src['round_map'].items()}
    surf_map={int(k):v for k,v in src['surface_map'].items()}
    if not set(df.r).issubset(round_map): raise RuntimeError('UNRESOLVED_ROUND_CODE')
    if not set(df.s).issubset(surf_map): raise RuntimeError('UNRESOLVED_SURFACE_CODE')

    out=pd.DataFrame({
      'season':df.y.astype(str),
      'date':pd.to_datetime(df.d.astype(str),format='%Y%m%d').dt.strftime('%Y-%m-%d'),
      'tournament':df.e.map(event_map),
      'level':'WTA Chall',
      'classification':'WTA_125_CHALLENGER',
      'classification_evidence':'source gate pre-normalization: tour_type_human=WTA Chall AND tour_type=4; normalized tt=4; bundle hashes verified',
      'round':df.r.map(round_map),
      'surface':df.s.map(surf_map),
      'home_player':df.h.map(players),
      'away_player':df.a.map(players),
      'home_player_id':df.h.astype(str),
      'away_player_id':df.a.astype(str),
      'winner_code':df.w,
      'home_set_score':df.hs,
      'away_set_score':df['as'],
      'source':'TennisData.app'})
    out['match_key']=df.apply(match_key,axis=1)
    dup=out['match_key'].duplicated(keep=False)
    if dup.any(): raise RuntimeError(f'AMBIGUOUS_DUPLICATE_MATCH_KEY {int(dup.sum())}')
    if not out.level.eq('WTA Chall').all() or not out.classification.eq('WTA_125_CHALLENGER').all():
        raise RuntimeError('FINAL_CONTAMINATION_FIREWALL_BLOCKED')

    OUT.mkdir(parents=True,exist_ok=True)
    out.sort_values(['season','date','tournament','round','home_player','away_player']).to_csv(OUT_CSV,index=False)
    missing_winner=int(df.w.isna().sum())
    missing_scores=int((df.hs.isna()|df['as'].isna()).sum())
    m={
      'source':'TennisData.app user-supplied season CSVs',
      'scope':'WTA Challenger / WTA 125 ONLY',
      'input_transport':'HASH_VERIFIED_INDEPENDENT_BASE64_PARTS_XZ',
      'source_pre_normalization_gate_verified':True,
      'source_gate':EXPECTED_GATE,
      'years':{str(y):{'source_rows':EXPECTED[y],'accepted_wta_challenger_rows':EXPECTED[y]} for y in EXPECTED},
      'source_rows':len(df),'rows_after_validation':len(out),
      'main_tour_rows_integrated':0,'contamination_firewall':'PASS',
      'missing_winner_rows':missing_winner,'missing_set_score_rows':missing_scores,
      'normalized_source_csv_sha256':bundle['source_csv_sha256'],
      'compressed_bundle_sha256':bundle['compressed_sha256'],
      'original_filtered_source_sha256':{y:v['sha256'] for y,v in src['source_files'].items()},
      'generated_at_utc':datetime.now(timezone.utc).isoformat()}
    MANIFEST_OUT.write_text(json.dumps(m,indent=2)+'\n')
    print(json.dumps(m,indent=2))

if __name__=='__main__': main()
