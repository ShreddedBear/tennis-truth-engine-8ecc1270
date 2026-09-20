#!/usr/bin/env python3
import os,json,time,urllib.parse,urllib.request,urllib.error
from collections import defaultdict
BASE='https://sports.bzzoiro.com/tennis/api/v2'
TOKEN=os.environ['BSD_TENNIS_API_KEY']
HEAD={'Authorization':f'Token {TOKEN}','User-Agent':'tennis-truth-engine-bsd-boundary-v2/1.0'}
YEARS=list(range(2026,1999,-1)); TARGET=3; MAX_PAGES=60

def get(path,params=None):
    url=BASE+path
    if params: url+='?'+urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers=HEAD),timeout=30) as r:return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:b=json.loads(e.read().decode())
        except:b={}
        return e.code,b
    except Exception as e:return 0,{'error':type(e).__name__}

def cls(m):
    t=m.get('tournament') or {}; p1=m.get('player1') or {}; p2=m.get('player2') or {}
    circuit=str(t.get('circuit') or m.get('circuit') or '').upper(); cat=str(t.get('category') or m.get('category') or m.get('tournament_level') or '').lower(); name=str(t.get('name') or '').lower(); gender=str(p1.get('gender') or p2.get('gender') or '').upper()
    is_ch=('challenger' in cat or 'challenger' in name or '125' in cat or '125' in name)
    if is_ch and (circuit=='WTA' or gender=='F'): return 'WTA_CHALLENGER'
    if is_ch and (circuit=='ATP' or gender=='M'): return 'ATP_CHALLENGER'
    if circuit=='WTA' or gender=='F': return 'WTA_MAIN'
    if circuit=='ATP' or gender=='M': return 'ATP_MAIN'
    return 'UNKNOWN'

def pbp_ok(x):
    if not x:return False
    blob=json.dumps(x).lower()
    return ('points' in blob or 'point_sequence' in blob or 'score_sequence' in blob) and ('server' in blob or '15' in blob or '40' in blob)

# Discovery deliberately uses broad pagination, then direct-tests discovered BSD match IDs.
rows=[]; by=defaultdict(list)
for y in YEARS:
    need={k:TARGET for k in ('ATP_MAIN','WTA_MAIN','ATP_CHALLENGER','WTA_CHALLENGER')}
    seen=set()
    for page in range(MAX_PAGES):
        st,data=get('/matches/',{'status':'finished','date_from':f'{y}-01-01','date_to':f'{y}-12-31','limit':200,'offset':page*200})
        if st!=200: break
        ms=data.get('results',[]) if isinstance(data,dict) else []
        if not ms: break
        for m in ms:
            mid=m.get('id'); tour=cls(m)
            if not mid or mid in seen or tour not in need or need[tour]<=0: continue
            seen.add(mid)
            # Direct ID test: no date filter is used on the PBP request.
            ps,payload=get(f'/matches/{mid}/point-by-point/')
            ok=(ps==200 and pbp_ok(payload))
            r={'year':y,'tour':tour,'match_id':mid,'players':[(m.get('player1') or {}).get('name'),(m.get('player2') or {}).get('name')],'tournament':(m.get('tournament') or {}).get('name'),'date':m.get('match_date'),'direct_id_pbp':'YES' if ok else 'NO','http_status':ps}
            rows.append(r); by[(y,tour)].append(r); need[tour]-=1; print(json.dumps(r,separators=(',',':')),flush=True); time.sleep(.12)
        if all(v<=0 for v in need.values()): break
    print('YEAR_DONE',y,{k:len(by[(y,k)]) for k in need},flush=True)

summary=[]
for tour in ('ATP_MAIN','WTA_MAIN','ATP_CHALLENGER','WTA_CHALLENGER'):
    ys=[y for y in YEARS if any(r['direct_id_pbp']=='YES' for r in by[(y,tour)])]
    ar=[r for r in rows if r['tour']==tour]
    summary.append({'tour':tour,'earliest_confirmed_direct_id_pbp_year':min(ys) if ys else None,'matches_tested':len(ar),'pbp_yes':sum(r['direct_id_pbp']=='YES' for r in ar),'pbp_no':sum(r['direct_id_pbp']=='NO' for r in ar)})
os.makedirs('artifacts/bsd-pbp-boundary-v2',exist_ok=True)
json.dump(rows,open('artifacts/bsd-pbp-boundary-v2/results.json','w'),indent=2); json.dump(summary,open('artifacts/bsd-pbp-boundary-v2/summary.json','w'),indent=2)
with open('artifacts/bsd-pbp-boundary-v2/summary.md','w') as f:
    f.write('| Tour | Earliest direct-ID PBP | Tested | PBP Yes | PBP No |\n|---|---:|---:|---:|---:|\n')
    for s in summary:f.write(f"| {s['tour']} | {s['earliest_confirmed_direct_id_pbp_year'] or 'NONE'} | {s['matches_tested']} | {s['pbp_yes']} | {s['pbp_no']} |\n")
print('FINAL',json.dumps(summary),flush=True)
