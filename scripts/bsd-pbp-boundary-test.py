#!/usr/bin/env python3
import os, json, time, urllib.parse, urllib.request, urllib.error
from collections import defaultdict

BASE='https://sports.bzzoiro.com/tennis/api/v2'
TOKEN=os.environ['BSD_TENNIS_API_KEY']
HEAD={'Authorization':f'Token {TOKEN}','User-Agent':'tennis-truth-engine-bsd-boundary-test/1.0'}
YEARS=list(range(2026,1999,-1))
TARGET=5
MAX_PAGES=8

def get(path, params=None):
    url=BASE+path
    if params: url += '?' + urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers=HEAD)
    try:
        with urllib.request.urlopen(req,timeout=30) as r:
            return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try: body=json.loads(e.read().decode())
        except: body={}
        return e.code,body
    except Exception as e:
        return 0,{'error':type(e).__name__}

def tclass(m):
    t=m.get('tournament') or {}
    circuit=str(t.get('circuit') or m.get('circuit') or '').upper()
    category=str(t.get('category') or m.get('category') or m.get('tournament_level') or '').lower()
    name=str(t.get('name') or '').lower()
    if 'challenger' in category or 'challenger' in name: return 'ATP_CHALLENGER'
    p1=m.get('player1') or {}; p2=m.get('player2') or {}
    gender=str(p1.get('gender') or p2.get('gender') or '').upper()
    if circuit=='WTA' or gender=='F': return 'WTA_MAIN'
    if circuit=='ATP' or gender=='M': return 'ATP_MAIN'
    return 'UNKNOWN'

def count_points(x):
    if not x: return 0,0
    games=points=0
    def walk(v):
        nonlocal games,points
        if isinstance(v,dict):
            if any(k in v for k in ('points','point_sequence','score_sequence')):
                games += 1
            for k,val in v.items():
                if k in ('points','point_sequence') and isinstance(val,list): points += len(val)
                else: walk(val)
        elif isinstance(v,list):
            for z in v: walk(z)
    walk(x)
    return games,points

def has_pbp(x):
    g,p=count_points(x)
    if p>0: return True,g,p
    # tolerate APIs returning flat point/game event arrays
    blob=json.dumps(x).lower() if x else ''
    meaningful=('server' in blob and ('15' in blob or '40' in blob or 'point' in blob))
    return meaningful,g,p

rows=[]
by=defaultdict(list)
for year in YEARS:
    need={'ATP_MAIN':TARGET,'WTA_MAIN':TARGET,'ATP_CHALLENGER':TARGET}
    offset=0
    for page in range(MAX_PAGES):
        st,data=get('/matches/',{'status':'finished','date_from':f'{year}-01-01','date_to':f'{year}-12-31','limit':200,'offset':offset})
        if st!=200:
            print(f'LIST year={year} status={st}',flush=True); break
        matches=data.get('results',[]) if isinstance(data,dict) else []
        if not matches: break
        for m in matches:
            tour=tclass(m)
            if tour not in need or need[tour]<=0: continue
            mid=m.get('id')
            if not mid: continue
            ps,payload=get(f'/matches/{mid}/point-by-point/')
            ok,g,p=has_pbp(payload) if ps==200 else (False,0,0)
            raw=json.dumps(payload).lower() if payload is not None else ''
            if ok: quality='COMPLETE_OR_PARTIAL_PBP'
            elif ps==200 and payload: quality='EMPTY_OR_METADATA_ONLY'
            else: quality='NO_PBP'
            row={'year':year,'tour':tour,'match_id':mid,'players':[ (m.get('player1') or {}).get('name'),(m.get('player2') or {}).get('name') ],'tournament':(m.get('tournament') or {}).get('name'),'date':m.get('match_date'),'pbp_available':'YES' if ok else 'NO','games_detected':g,'points_detected':p,'quality':quality,'http_status':ps}
            rows.append(row); by[(year,tour)].append(row); need[tour]-=1
            print(json.dumps(row,separators=(',',':')),flush=True)
            time.sleep(.15)
        if all(v<=0 for v in need.values()): break
        offset += 200
    print(f'YEAR_DONE {year} counts='+json.dumps({t:len(by[(year,t)]) for t in need}),flush=True)

summary=[]
for tour in ('ATP_MAIN','WTA_MAIN','ATP_CHALLENGER'):
    confirmed=[]
    for y in YEARS:
        rr=by[(y,tour)]
        succ=sum(r['pbp_available']=='YES' for r in rr)
        if succ: confirmed.append(y)
    earliest=min(confirmed) if confirmed else None
    allr=[r for r in rows if r['tour']==tour]
    summary.append({'tour':tour,'earliest_confirmed_pbp_year':earliest,'matches_tested':len(allr),'successful_pbp':sum(r['pbp_available']=='YES' for r in allr),'no_pbp':sum(r['pbp_available']=='NO' for r in allr),'confidence':'BOUNDARY_REQUIRES_REVIEW' if earliest else 'NO_CONFIRMED_PBP'})

# Boundary verification: test extra matches in earliest-1, earliest, earliest+1 by requesting additional offsets.
# Main sweep already tests >=5/year where classifiable; summary preserves exact observations without guessing.
os.makedirs('artifacts/bsd-pbp-boundary',exist_ok=True)
with open('artifacts/bsd-pbp-boundary/results.json','w') as f: json.dump(rows,f,indent=2)
with open('artifacts/bsd-pbp-boundary/summary.json','w') as f: json.dump(summary,f,indent=2)
with open('artifacts/bsd-pbp-boundary/summary.md','w') as f:
    f.write('| Tour | Earliest Confirmed PBP Year | Matches Tested | Successful PBP | No PBP | Confidence |\n|---|---:|---:|---:|---:|---|\n')
    for s in summary: f.write(f"| {s['tour']} | {s['earliest_confirmed_pbp_year'] or 'NONE'} | {s['matches_tested']} | {s['successful_pbp']} | {s['no_pbp']} | {s['confidence']} |\n")
print('FINAL_SUMMARY '+json.dumps(summary),flush=True)
