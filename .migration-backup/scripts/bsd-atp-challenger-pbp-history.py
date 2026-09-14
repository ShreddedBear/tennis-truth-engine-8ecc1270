#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, os, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

BASE='https://sports.bzzoiro.com/tennis/api/v2'
TOKEN=os.environ['BSD_TENNIS_API_KEY']
HEAD={'Authorization':f'Token {TOKEN}','User-Agent':'tennis-truth-engine-bsd-atp-challenger-history/1.0'}
OUT=Path('data/audit/bsd-atp-challenger-pbp-history')
PAGE_SIZE=200
MAX_PAGES=100


def get(path, params=None):
    url=BASE+path
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers=HEAD)
    try:
        with urllib.request.urlopen(req,timeout=45) as r:
            return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try: body=json.loads(e.read().decode())
        except Exception: body={}
        return e.code,body
    except Exception as e:
        return 0,{'error':type(e).__name__}


def text(v): return str(v or '').strip()


def atp_challenger(m):
    """Strict ATP Challenger classifier. Do not infer Challenger from gender alone."""
    t=m.get('tournament') or {}
    circuit=text(t.get('circuit') or m.get('circuit')).upper()
    category=text(t.get('category') or m.get('category') or m.get('tournament_level')).lower()
    name=text(t.get('name')).lower()
    tour_type=text(t.get('type') or m.get('type')).lower()
    blob=' '.join((category,name,tour_type))

    # BSD Challenger records are expected under the ATP circuit with Challenger
    # explicitly represented in tournament metadata. Exclude ITF/futures/etc.
    if circuit != 'ATP':
        return False
    if 'challenger' not in blob:
        return False
    exclusions=('utr','itf','futures','satellite','exhibition')
    if any(x in blob for x in exclusions):
        return False
    return True


def summarize_pbp(x):
    games=points=0
    valid_point_rows=0
    malformed_point_rows=0
    servers=0
    breaks=0
    def walk(v):
        nonlocal games,points,valid_point_rows,malformed_point_rows,servers,breaks
        if isinstance(v,dict):
            if 'game' in v and 'points' in v:
                games+=1
                if v.get('server') is not None: servers+=1
                if v.get('break') is not None: breaks+=1
            pts=v.get('points')
            if isinstance(pts,list):
                points+=len(pts)
                for p in pts:
                    if isinstance(p,dict) and p.get('winner') in ('player1','player2') and 'player1_score' in p and 'player2_score' in p:
                        valid_point_rows+=1
                    else:
                        malformed_point_rows+=1
            for k,val in v.items():
                if k!='points': walk(val)
        elif isinstance(v,list):
            for z in v: walk(z)
    walk(x)
    available=bool(isinstance(x,dict) and x.get('available') is True)
    structurally_present=available and points>0 and valid_point_rows==points
    return {
        'available_flag':available,'games':games,'points':points,
        'valid_point_rows':valid_point_rows,'malformed_point_rows':malformed_point_rows,
        'games_with_server':servers,'games_with_break_field':breaks,
        'structurally_present':structurally_present
    }


def year_scan(year):
    rows=[]; offset=0; listed=0; classified=0; list_failures=[]
    for page in range(MAX_PAGES):
        st,data=get('/matches/',{'status':'finished','date_from':f'{year}-01-01','date_to':f'{year}-12-31','limit':PAGE_SIZE,'offset':offset})
        if st!=200:
            list_failures.append({'offset':offset,'http_status':st,'body_type':type(data).__name__})
            break
        matches=data.get('results',[]) if isinstance(data,dict) else []
        if not matches: break
        listed += len(matches)
        for m in matches:
            if not atp_challenger(m): continue
            classified+=1
            mid=m.get('id')
            if not mid: continue
            ps,payload=get(f'/matches/{mid}/point-by-point/')
            sm=summarize_pbp(payload) if ps==200 else {'available_flag':False,'games':0,'points':0,'valid_point_rows':0,'malformed_point_rows':0,'games_with_server':0,'games_with_break_field':0,'structurally_present':False}
            t=m.get('tournament') or {}
            row={
                'year':year,'match_id':mid,'date':m.get('match_date'),
                'players':[(m.get('player1') or {}).get('name'),(m.get('player2') or {}).get('name')],
                'player_ids':[(m.get('player1') or {}).get('id'),(m.get('player2') or {}).get('id')],
                'tournament':t.get('name'),'circuit':t.get('circuit') or m.get('circuit'),
                'category':t.get('category') or m.get('category') or m.get('tournament_level'),
                'round':(m.get('round') or {}).get('name') if isinstance(m.get('round'),dict) else m.get('round'),
                'surface':t.get('surface') or m.get('surface'),'winner_id':m.get('winner_id'),
                'pbp_http':ps,**sm
            }
            rows.append(row)
            print(json.dumps(row,separators=(',',':')),flush=True)
            time.sleep(.05)
        if len(matches)<PAGE_SIZE: break
        offset += PAGE_SIZE
    good=[r for r in rows if r['structurally_present']]
    dates=sorted([str(r['date']) for r in good if r.get('date')])
    summary={
        'year':year,'matches_listed_all_tours':listed,'atp_challenger_matches':classified,
        'atp_challenger_pbp_requests':len(rows),'pbp_available':len(good),
        'no_pbp_or_unusable':len(rows)-len(good),'list_failures':list_failures,
        'earliest_confirmed_pbp_date':dates[0] if dates else None,
        'latest_confirmed_pbp_date':dates[-1] if dates else None,
        'generated_at_utc':datetime.now(timezone.utc).isoformat()
    }
    d=OUT/str(year);d.mkdir(parents=True,exist_ok=True)
    (d/'results.json').write_text(json.dumps(rows,indent=2)+'\n')
    (d/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    (d/'UPDATE.md').write_text(
        f"* {classified:,} strict ATP Challenger finished matches examined for {year}.\n"
        f"* {len(good):,} BSD matches returned usable point-by-point data.\n"
        f"* {len(rows)-len(good):,} returned no usable PBP.\n"
        f"* Earliest confirmed BSD ATP Challenger PBP date in {year}: {summary['earliest_confirmed_pbp_date'] or 'NONE'}.\n"
        f"* No second PBP provider was used; this is a BSD availability/structure scan only.\n"
    )
    return summary


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--year',type=int,required=True);a=ap.parse_args()
    current=datetime.now(timezone.utc).year
    if a.year<1968 or a.year>current: raise SystemExit('year outside 1968..current')
    s=year_scan(a.year); print('YEAR_SUMMARY '+json.dumps(s,separators=(',',':')),flush=True)

if __name__=='__main__': main()
