#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,os,urllib.request,urllib.error
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'data'/'audit'/'bsd-wta-challenger-pbp'/'matches.jsonl'
OUT=ROOT/'data'/'audit'/'bsd-wta-challenger-pbp-validation'
METRICS=ROOT/'data'/'metrics'/'pbp'/'wta_challenger'
BASE='https://sports.bzzoiro.com/tennis/api/v2'
TOKEN=os.environ['BSD_TENNIS_API_KEY']
HEAD={'Authorization':f'Token {TOKEN}','User-Agent':'tennis-truth-engine-wta-challenger-validator/1.0'}

def get_match(mid):
    req=urllib.request.Request(f'{BASE}/matches/{mid}/',headers=HEAD)
    try:
        with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e:return e.code,{}
    except Exception:return 0,{}

def norm(s):return ' '.join(str(s or '').lower().replace('-',' ').split())

def extract_names(m):
    p1=m.get('player1') or {}; p2=m.get('player2') or {}
    return norm(p1.get('name')),norm(p2.get('name'))

def is_wta125(m):
    t=m.get('tournament') or {}; p1=m.get('player1') or {}; p2=m.get('player2') or {}
    circuit=str(t.get('circuit') or m.get('circuit') or '').upper(); cat=str(t.get('category') or m.get('category') or m.get('tournament_level') or '').lower(); name=str(t.get('name') or '').lower(); gender=str(p1.get('gender') or p2.get('gender') or '').upper()
    return (circuit=='WTA' or gender=='F') and ('challenger' in cat or 'challenger' in name or '125' in cat or '125' in name)

def legal_set(a,b):
    if max(a,b)<6:return False
    if (a,b) in ((7,6),(6,7)):return True
    return abs(a-b)>=2 and max(a,b)>=6

def structural(pbp):
    errs=[]; sets=pbp.get('sets') if isinstance(pbp,dict) else None
    if not isinstance(sets,list) or not sets:return False,{},['NO_SETS']
    set_scores=[]; set_winners=[]; total_games=total_points=breaks=0
    for si,s in enumerate(sets,1):
        games=s.get('games') if isinstance(s,dict) else None
        if not isinstance(games,list) or not games:errs.append(f'SET_{si}_NO_GAMES');continue
        a=b=0
        for gi,g in enumerate(games,1):
            server=g.get('server'); winner=g.get('winner'); pts=g.get('points')
            if server not in ('player1','player2') or winner not in ('player1','player2'):errs.append(f'S{si}G{gi}_BAD_SERVER_WINNER');continue
            if not isinstance(pts,list) or not pts:errs.append(f'S{si}G{gi}_NO_POINTS')
            else:
                total_points+=len(pts)
                if any((not isinstance(p,dict) or p.get('winner') not in ('player1','player2')) for p in pts):errs.append(f'S{si}G{gi}_BAD_POINT_WINNER')
            na=int(g.get('player1_games',-1)); nb=int(g.get('player2_games',-1))
            expa=a+(1 if winner=='player1' else 0); expb=b+(1 if winner=='player2' else 0)
            if (na,nb)!=(expa,expb):errs.append(f'S{si}G{gi}_GAME_COUNTER')
            a,b=na,nb; total_games+=1
            br=bool(g.get('break'))
            if br!=(winner!=server):errs.append(f'S{si}G{gi}_BREAK_FLAG')
            if br:breaks+=1
        set_scores.append([a,b])
        if not legal_set(a,b):errs.append(f'SET_{si}_ILLEGAL_END_{a}_{b}')
        elif a>b:set_winners.append('player1')
        else:set_winners.append('player2')
    wins=Counter(set_winners); mw='player1' if wins['player1']>wins['player2'] else 'player2' if wins['player2']>wins['player1'] else None
    if len(set_scores)>3:errs.append('TOO_MANY_SETS_FOR_WTA_BO3')
    if mw is None or max(wins.values() or [0])<2:errs.append('NO_BO3_MATCH_WINNER')
    return not errs,{'set_scores':set_scores,'match_winner_slot':mw,'total_games':total_games,'total_points':total_points,'breaks':breaks},errs

def main():
    OUT.mkdir(parents=True,exist_ok=True); METRICS.mkdir(parents=True,exist_ok=True)
    seen_ids=set();seen_hash=set();approved=[];quarantine=[]
    for line in SRC.read_text().splitlines():
        if not line.strip():continue
        r=json.loads(line); reasons=[]
        mid=str(r.get('match_id')); sha=r.get('pbp_sha256'); pbp=r.get('pbp') or {}
        if r.get('tour')!='WTA_CHALLENGER':reasons.append('TOUR_CONTAMINATION')
        if int(r.get('year',0))<2025:reasons.append('OUT_OF_APPROVED_YEAR_WINDOW')
        calc=hashlib.sha256(json.dumps(pbp,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        if calc!=sha:reasons.append('PBP_HASH_MISMATCH')
        if mid in seen_ids:reasons.append('DUPLICATE_MATCH_ID')
        if sha in seen_hash:reasons.append('DUPLICATE_PBP_HASH')
        seen_ids.add(mid);seen_hash.add(sha)
        if str(pbp.get('match_id'))!=mid or pbp.get('available') is not True:reasons.append('PBP_MATCH_ID_OR_AVAILABILITY')
        ok,metrics,serrs=structural(pbp)
        if not ok:reasons.extend(serrs)
        st,detail=get_match(mid)
        if st!=200:reasons.append(f'MATCH_DETAIL_HTTP_{st}')
        else:
            if not is_wta125(detail):reasons.append('BSD_DETAIL_NOT_WTA_CHALLENGER')
            n1,n2=extract_names(detail); rn1,rn2=norm(r.get('player1')),norm(r.get('player2'))
            if {n1,n2}!={rn1,rn2}:reasons.append('PLAYER_IDENTITY_MISMATCH')
            dt=(detail.get('tournament') or {}).get('name')
            if dt and r.get('tournament') and norm(dt)!=norm(r.get('tournament')):reasons.append('TOURNAMENT_MISMATCH')
        base={'tour':'WTA_CHALLENGER','year':r.get('year'),'match_id':r.get('match_id'),'date':r.get('date'),'tournament':r.get('tournament'),'player1':r.get('player1'),'player2':r.get('player2'),'pbp_sha256':sha,'metrics':metrics,'validated_at_utc':datetime.now(timezone.utc).isoformat()}
        if reasons:
            base['status']='QUARANTINED';base['reasons']=sorted(set(reasons));quarantine.append(base)
        else:
            base['status']='APPROVED_WTA_CHALLENGER_PBP';approved.append(base)
    (OUT/'approved.jsonl').write_text(''.join(json.dumps(x,separators=(',',':'))+'\n' for x in approved))
    (OUT/'quarantine.jsonl').write_text(''.join(json.dumps(x,separators=(',',':'))+'\n' for x in quarantine))
    # Metrics integration index is namespace-only: no ATP/WTA-main consumers can match this path/tour.
    (METRICS/'approved-index.jsonl').write_text(''.join(json.dumps(x,separators=(',',':'))+'\n' for x in approved))
    summary={'scope':'WTA Challenger/WTA 125 only','source_records':len(approved)+len(quarantine),'approved_for_metrics':len(approved),'quarantined':len(quarantine),'unique_approved_match_ids':len({x['match_id'] for x in approved}),'unique_approved_pbp_hashes':len({x['pbp_sha256'] for x in approved}),'metrics_namespace':'data/metrics/pbp/wta_challenger/approved-index.jsonl','other_tours_excluded':True,'generated_at_utc':datetime.now(timezone.utc).isoformat(),'quarantine_reason_counts':dict(Counter(z for x in quarantine for z in x['reasons']))}
    (OUT/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    (OUT/'summary.md').write_text(f"# WTA Challenger PBP Validation + Metrics Integration\n\n- Source records: **{summary['source_records']}**\n- Approved for WTA Challenger metrics: **{summary['approved_for_metrics']}**\n- Quarantined: **{summary['quarantined']}**\n- Unique approved match IDs: **{summary['unique_approved_match_ids']}**\n- Unique approved PBP hashes: **{summary['unique_approved_pbp_hashes']}**\n- Metrics namespace: `{summary['metrics_namespace']}`\n- Other tours excluded: **YES**\n")
    print(json.dumps(summary,separators=(',',':')))
if __name__=='__main__':main()
