#!/usr/bin/env python3
from __future__ import annotations
import json,sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path('data/audit/bsd-atp-main-pbp-history')
CURRENT=datetime.now(timezone.utc).year
FLOOR=1968

def load(y):
    p=ROOT/str(y)/'summary.json'
    if not p.exists(): return None
    try:return json.loads(p.read_text())
    except Exception:return None

def next_year():
    for y in range(CURRENT,FLOOR-1,-1):
        if load(y) is None:return y
    return None

def aggregate():
    rows=[load(y) for y in range(CURRENT,FLOOR-1,-1) if load(y)]
    years_with_pbp=[r['year'] for r in rows if r.get('pbp_available',0)>0]
    earliest_date=None
    for r in rows:
        d=r.get('earliest_confirmed_pbp_date')
        if d and (earliest_date is None or d<earliest_date): earliest_date=d
    nxt=next_year()
    progress={
        'updated_at_utc':datetime.now(timezone.utc).isoformat(),
        'current_year':CURRENT,'floor_year':FLOOR,
        'years_scanned':len(rows),'years_total':CURRENT-FLOOR+1,
        'years_with_confirmed_pbp':sorted(years_with_pbp),
        'earliest_confirmed_pbp_year':min(years_with_pbp) if years_with_pbp else None,
        'earliest_confirmed_pbp_date':earliest_date,
        'total_atp_main_matches_examined':sum(int(r.get('atp_main_matches',0)) for r in rows),
        'total_usable_pbp':sum(int(r.get('pbp_available',0)) for r in rows),
        'total_no_pbp_or_unusable':sum(int(r.get('no_pbp_or_unusable',0)) for r in rows),
        'next_year':nxt,'scan_complete':nxt is None
    }
    ROOT.mkdir(parents=True,exist_ok=True)
    (ROOT/'progress.json').write_text(json.dumps(progress,indent=2)+'\n')
    lines=['# BSD ATP Main PBP Historical Scan','',f"Years scanned: {progress['years_scanned']} / {progress['years_total']}",f"Next year: {nxt if nxt else 'COMPLETE'}",f"Earliest confirmed PBP year so far: {progress['earliest_confirmed_pbp_year'] or 'NONE'}",f"Earliest confirmed PBP date so far: {progress['earliest_confirmed_pbp_date'] or 'NONE'}",'', '| Year | ATP Main Matches | Usable BSD PBP | No PBP/Unusable | Earliest PBP Date |','|---:|---:|---:|---:|---|']
    for r in sorted(rows,key=lambda x:x['year'],reverse=True):
        lines.append(f"| {r['year']} | {r['atp_main_matches']} | {r['pbp_available']} | {r['no_pbp_or_unusable']} | {r.get('earliest_confirmed_pbp_date') or 'NONE'} |")
    (ROOT/'progress.md').write_text('\n'.join(lines)+'\n')
    return progress

if __name__=='__main__':
    p=aggregate()
    if '--next' in sys.argv: print('COMPLETE' if p['next_year'] is None else p['next_year'])
    else: print(json.dumps(p,separators=(',',':')))
