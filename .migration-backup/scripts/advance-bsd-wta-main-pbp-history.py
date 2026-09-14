#!/usr/bin/env python3
from __future__ import annotations
import json,sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path('data/audit/bsd-wta-main-pbp-history')
CURRENT=datetime.now(timezone.utc).year
BOUNDARY_YEAR=2024
BOUNDARY_DATE='2024-12-02'


def load(y):
    p=ROOT/str(y)/'summary.json'
    if not p.exists(): return None
    try:return json.loads(p.read_text())
    except Exception:return None


def scanned_rows():
    return [load(y) for y in range(CURRENT,BOUNDARY_YEAR-1,-1) if load(y)]


def next_year():
    for y in range(CURRENT,BOUNDARY_YEAR-1,-1):
        if load(y) is None:return y
    return None


def aggregate():
    rows=scanned_rows()
    years_with_pbp=[int(r['year']) for r in rows if int(r.get('pbp_available',0))>0]
    earliest_date=None
    for r in rows:
        d=r.get('earliest_confirmed_pbp_date')
        if d and (earliest_date is None or d<earliest_date): earliest_date=d
    nxt=next_year()
    complete=nxt is None
    progress={
        'updated_at_utc':datetime.now(timezone.utc).isoformat(),
        'current_year':CURRENT,
        'boundary_year':BOUNDARY_YEAR,
        'boundary_date':BOUNDARY_DATE,
        'historical_boundary_confirmed':True,
        'boundary_source':'user-confirmed after BSD availability scan',
        'years_scanned':len(rows),
        'years_expected':CURRENT-BOUNDARY_YEAR+1,
        'years_with_confirmed_pbp':sorted(years_with_pbp),
        'earliest_confirmed_pbp_year':min(years_with_pbp) if years_with_pbp else None,
        'earliest_confirmed_pbp_date':earliest_date,
        'total_wta_main_matches_examined':sum(int(r.get('wta_main_matches',0)) for r in rows),
        'total_usable_pbp':sum(int(r.get('pbp_available',0)) for r in rows),
        'total_no_pbp_or_unusable':sum(int(r.get('no_pbp_or_unusable',0)) for r in rows),
        'next_year':nxt,
        'scan_complete':complete,
        'older_years_policy':'DO_NOT_SCAN_OR_USE_BSD_WTA_MAIN_PBP_BEFORE_2024-12-02'
    }
    ROOT.mkdir(parents=True,exist_ok=True)
    (ROOT/'progress.json').write_text(json.dumps(progress,indent=2)+'\n')
    lines=['# BSD WTA Main PBP Historical Scan','',f"Locked boundary: {BOUNDARY_DATE}",f"Years scanned in accepted window: {progress['years_scanned']} / {progress['years_expected']}",f"Next year: {nxt if nxt else 'COMPLETE'}",f"Earliest confirmed PBP date: {progress['earliest_confirmed_pbp_date'] or 'NONE'}",'Historical boundary confirmed: YES','Older years: DO NOT SCAN / DO NOT USE for BSD WTA Main PBP','', '| Year | WTA Main Matches | Usable BSD PBP | No PBP/Unusable | Earliest PBP Date |','|---:|---:|---:|---:|---|']
    for r in sorted(rows,key=lambda x:int(x['year']),reverse=True):
        lines.append(f"| {r['year']} | {r['wta_main_matches']} | {r['pbp_available']} | {r['no_pbp_or_unusable']} | {r.get('earliest_confirmed_pbp_date') or 'NONE'} |")
    (ROOT/'progress.md').write_text('\n'.join(lines)+'\n')
    return progress

if __name__=='__main__':
    p=aggregate()
    if '--next' in sys.argv: print('COMPLETE' if p['next_year'] is None else p['next_year'])
    else: print(json.dumps(p,separators=(',',':')))
