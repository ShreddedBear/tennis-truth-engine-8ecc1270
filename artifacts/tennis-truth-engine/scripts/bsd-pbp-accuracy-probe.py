#!/usr/bin/env python3
import json, os, urllib.request, urllib.parse
from pathlib import Path

BASE='https://sports.bzzoiro.com/tennis/api/v2'
TOKEN=os.environ['BSD_TENNIS_API_KEY']
HEAD={'Authorization':f'Token {TOKEN}','User-Agent':'tennis-truth-engine-bsd-accuracy-probe/1.0'}
OUT=Path('data/audit/bsd-pbp-accuracy')
OUT.mkdir(parents=True,exist_ok=True)
# Known 2025 main-tour examples already observed in the persisted boundary report.
MATCH_IDS=[294,295,296,298,299,302,303,311]

def get(path):
    req=urllib.request.Request(BASE+path,headers=HEAD)
    with urllib.request.urlopen(req,timeout=30) as r:
        return r.status,json.loads(r.read().decode())

def summarize_payload(x):
    top=list(x.keys()) if isinstance(x,dict) else []
    games=points=0
    key_counts={}
    samples=[]
    def walk(v,path=''):
        nonlocal games,points
        if isinstance(v,dict):
            for k,val in v.items():
                key_counts[k]=key_counts.get(k,0)+1
                low=k.lower()
                if low in ('points','point_sequence','score_sequence') and isinstance(val,list):
                    points += len(val)
                    games += 1
                    if len(samples)<3:samples.append({'path':path+'/'+k,'value':val[:8]})
                walk(val,path+'/'+k)
        elif isinstance(v,list):
            for i,z in enumerate(v[:500]): walk(z,path+f'/{i}')
    walk(x)
    return {'top_level_keys':top,'games_detected':games,'points_detected':points,'key_counts':key_counts,'samples':samples}

rows=[]
for mid in MATCH_IDS:
    try:
        ms,m=get(f'/matches/{mid}/')
        ps,p=get(f'/matches/{mid}/point-by-point/')
        row={
            'match_id':mid,'match_http':ms,'pbp_http':ps,
            'players':[(m.get('player1') or {}).get('name'),(m.get('player2') or {}).get('name')] if isinstance(m,dict) else [],
            'tournament':((m.get('tournament') or {}).get('name') if isinstance(m,dict) else None),
            'match_date':m.get('match_date') if isinstance(m,dict) else None,
            'status':m.get('status') if isinstance(m,dict) else None,
            'round_name':m.get('round_name') if isinstance(m,dict) else None,
            'sets_detail':m.get('sets_detail') if isinstance(m,dict) else None,
            'winner_id':m.get('winner_id') if isinstance(m,dict) else None,
            'pbp_summary':summarize_payload(p),
            'pbp_payload':p,
        }
    except Exception as e:
        row={'match_id':mid,'error':type(e).__name__+': '+str(e)}
    rows.append(row)

(OUT/'probe.json').write_text(json.dumps(rows,indent=2)+"\n")
summary={
 'matches_requested':len(MATCH_IDS),
 'matches_returned':sum(1 for r in rows if r.get('match_http')==200),
 'pbp_200':sum(1 for r in rows if r.get('pbp_http')==200),
 'pbp_with_detected_points':sum(1 for r in rows if (r.get('pbp_summary') or {}).get('points_detected',0)>0),
}
(OUT/'summary.json').write_text(json.dumps(summary,indent=2)+"\n")
print(json.dumps(summary))
