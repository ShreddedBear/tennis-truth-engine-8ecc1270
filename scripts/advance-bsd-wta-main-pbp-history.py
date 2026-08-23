#!/usr/bin/env python3
from __future__ import annotations
import json,sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path('data/audit/bsd-wta-main-pbp-history')
CURRENT=datetime.now(timezone.utc).year
FLOOR=1968
CONFIRM_EMPTY_YEARS=3


def load(y):
    p=ROOT/str(y)/'summary.json'
    if not p.exists(): return None
    try:return json.loads(p.read_text())
    except Exception:return None


def scanned_rows():
    return [load(y) for y in range(CURRENT,FLOOR-1,-1) if load(y)]


def boundary_reached(rows):
    """Stop only after PBP has been seen and 3 consecutive older, clean scans have zero PBP."""
    if not any(int(r.get('pbp_available',0))>0 for r in rows):
        return False,None
    by_year={int(r['year']):r for r in rows}
    years=sorted(by_year,reverse=True)
    if not years:
        return False,None
    earliest_with_pbp=min(int(r['year']) for r in rows if int(r.get('pbp_available',0))>0)
    empties=[]
    for y in range(earliest_with_pbp-1,FLOOR-1,-1):
        r=by_year.get(y)
        if r is None: break
        if not r.get('scan_valid_for_boundary',not r.get('list_failures')): break
        if int(r.get('pbp_available',0))>0: break
        empties.append(y)
        if len(empties)>=CONFIRM_EMPTY_YEARS:
            return True,empties[:CONFIRM_EMPTY_YEARS]
    return False,None


def next_year():
    rows=scanned_rows()
    reached,_=boundary_reached(rows)
    if reached:return None
    for y in range(CURRENT,FLOOR-1,-1):
        if load(y) is None:return y
    return None


def aggregate():
    rows=scanned_rows()
    years_with_pbp=[int(r['year']) for r in rows if int(r.get('pbp_available',0))>0]
    earliest_date=None
    for r in rows:
        d=r.get('earliest_confirmed_pbp_date')
        if d and (earliest_date is None or d<earliest_date): earliest_date=d
    reached,confirm_years=boundary_reached(rows)
    nxt=next_year()
    complete=reached or (nxt is None and len(rows)>=CURRENT-FLOOR+1)
    progress={
        'updated_at_utc':datetime.now(timezone.utc).isoformat(),
        'current_year':CURRENT,'floor_year':FLOOR,
        'boundary_confirmation_empty_years_required':CONFIRM_EMPTY_YEARS,
        'boundary_confirmation_years':confirm_years or [],
        'historical_boundary_confirmed':reached,
        'years_scanned':len(rows),'years_total_possible':CURRENT-FLOOR+1,
        'years_with_confirmed_pbp':sorted(years_with_pbp),
        'earliest_confirmed_pbp_year':min(years_with_pbp) if years_with_pbp else None,
        'earliest_confirmed_pbp_date':earliest_date,
        'total_wta_main_matches_examined':sum(int(r.get('wta_main_matches',0)) for r in rows),
        'total_usable_pbp':sum(int(r.get('pbp_available',0)) for r in rows),
        'total_no_pbp_or_unusable':sum(int(r.get('no_pbp_or_unusable',0)) for r in rows),
        'next_year':nxt,'scan_complete':complete
    }
    ROOT.mkdir(parents=True,exist_ok=True)
    (ROOT/'progress.json').write_text(json.dumps(progress,indent=2)+'\n')
    lines=['# BSD WTA Main PBP Historical Scan','',f"Years scanned: {progress['years_scanned']}",f"Next year: {nxt if nxt else 'COMPLETE'}",f"Earliest confirmed PBP year so far: {progress['earliest_confirmed_pbp_year'] or 'NONE'}",f"Earliest confirmed PBP date so far: {progress['earliest_confirmed_pbp_date'] or 'NONE'}",f"Historical boundary confirmed: {'YES' if reached else 'NO'}"]
    if confirm_years: lines.append(f"Boundary confirmation empty years: {', '.join(map(str,confirm_years))}")
    lines += ['', '| Year | WTA Main Matches | Usable BSD PBP | No PBP/Unusable | Earliest PBP Date |','|---:|---:|---:|---:|---|']
    for r in sorted(rows,key=lambda x:int(x['year']),reverse=True):
        lines.append(f"| {r['year']} | {r['wta_main_matches']} | {r['pbp_available']} | {r['no_pbp_or_unusable']} | {r.get('earliest_confirmed_pbp_date') or 'NONE'} |")
    (ROOT/'progress.md').write_text('\n'.join(lines)+'\n')
    return progress

if __name__=='__main__':
    p=aggregate()
    if '--next' in sys.argv: print('COMPLETE' if p['next_year'] is None else p['next_year'])
    else: print(json.dumps(p,separators=(',',':')))
