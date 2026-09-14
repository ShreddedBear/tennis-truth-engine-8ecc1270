#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,os,time,urllib.error,urllib.request
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
Q=ROOT/'data'/'audit'/'bsd-wta-challenger-pbp-validation'/'quarantine.jsonl'
SRC=ROOT/'data'/'audit'/'bsd-wta-challenger-pbp'/'matches.jsonl'
OUT=ROOT/'data'/'audit'/'bsd-wta-challenger-pbp-quarantine-audit'
METRICS=ROOT/'data'/'metrics'/'pbp'/'wta_challenger'/'approved-index.jsonl'
BASE='https://sports.bzzoiro.com/tennis/api/v2'
TOKEN=os.environ['BSD_TENNIS_API_KEY']
HEAD={'Authorization':f'Token {TOKEN}','User-Agent':'tennis-truth-engine-wta-challenger-quarantine-audit/1.0'}

def get(path, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(BASE+path,headers=HEAD),timeout=30) as r:
                return r.status,json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            code=e.code
            if code>=500 and i+1<tries: time.sleep(1.5*(i+1)); continue
            return code,{}
        except Exception:
            if i+1<tries: time.sleep(1.5*(i+1)); continue
            return 0,{}

def norm(s):return ' '.join(str(s or '').lower().replace('-',' ').split())

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
    sw=[]; scores=[]; tg=tp=brks=0
    for si,s in enumerate(sets,1):
        games=s.get('games') if isinstance(s,dict) else None
        if not isinstance(games,list) or not games: errs.append(f'SET_{si}_NO_GAMES'); continue
        a=b=0
        for gi,g in enumerate(games,1):
            server=g.get('server'); winner=g.get('winner'); pts=g.get('points')
            if server not in ('player1','player2') or winner not in ('player1','player2'):
                errs.append(f'S{si}G{gi}_BAD_SERVER_WINNER'); continue
            if not isinstance(pts,list) or not pts: errs.append(f'S{si}G{gi}_NO_POINTS')
            else:
                tp+=len(pts)
                if any(not isinstance(p,dict) or p.get('winner') not in ('player1','player2') for p in pts): errs.append(f'S{si}G{gi}_BAD_POINT_WINNER')
            try: na=int(g.get('player1_games',-1)); nb=int(g.get('player2_games',-1))
            except: na=nb=-1
            ea=a+(winner=='player1'); eb=b+(winner=='player2')
            if (na,nb)!=(ea,eb): errs.append(f'S{si}G{gi}_GAME_COUNTER')
            a,b=na,nb; tg+=1
            bf=bool(g.get('break'))
            if bf!=(winner!=server): errs.append(f'S{si}G{gi}_BREAK_FLAG')
            if bf: brks+=1
        scores.append([a,b])
        if not legal_set(a,b): errs.append(f'SET_{si}_ILLEGAL_END_{a}_{b}')
        elif a>b: sw.append('player1')
        else: sw.append('player2')
    c=Counter(sw); mw='player1' if c['player1']>c['player2'] else 'player2' if c['player2']>c['player1'] else None
    if len(scores)>3: errs.append('TOO_MANY_SETS_FOR_WTA_BO3')
    if mw is None or max(c.values() or [0])<2: errs.append('NO_BO3_MATCH_WINNER')
    return not errs,{'set_scores':scores,'match_winner_slot':mw,'total_games':tg,'total_points':tp,'breaks':brks},sorted(set(errs))

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    quarantined=[json.loads(x) for x in Q.read_text().splitlines() if x.strip()]
    src={str(r['match_id']):r for r in (json.loads(x) for x in SRC.read_text().splitlines() if x.strip())}
    existing=[]
    if METRICS.exists(): existing=[json.loads(x) for x in METRICS.read_text().splitlines() if x.strip()]
    ids={str(x['match_id']) for x in existing}; hashes={x['pbp_sha256'] for x in existing}
    promoted=[]; fixable=[]; invalid=[]; external=[]
    reason_counts=Counter(); class_counts=Counter()
    for old in quarantined:
        mid=str(old['match_id']); base=src.get(mid,{}); old_reasons=old.get('reasons',[])
        ds,detail=get(f'/matches/{mid}/'); ps,pbp=get(f'/matches/{mid}/point-by-point/')
        reasons=[]
        if ds!=200: reasons.append(f'MATCH_DETAIL_HTTP_{ds}')
        if ps!=200: reasons.append(f'PBP_HTTP_{ps}')
        metrics={}; ok=False
        if ps==200:
            ok,metrics,sr=structural(pbp); reasons.extend(sr)
            if str(pbp.get('match_id'))!=mid or pbp.get('available') is not True: reasons.append('PBP_MATCH_ID_OR_AVAILABILITY')
        if ds==200:
            if not is_wta125(detail): reasons.append('BSD_DETAIL_NOT_WTA_CHALLENGER')
            n1=norm((detail.get('player1') or {}).get('name')); n2=norm((detail.get('player2') or {}).get('name'))
            if {n1,n2}!={norm(base.get('player1')),norm(base.get('player2'))}: reasons.append('PLAYER_IDENTITY_MISMATCH')
            dt=(detail.get('tournament') or {}).get('name')
            if dt and base.get('tournament') and norm(dt)!=norm(base.get('tournament')): reasons.append('TOURNAMENT_MISMATCH')
        reasons=sorted(set(reasons))
        fresh_sha=hashlib.sha256(json.dumps(pbp,sort_keys=True,separators=(',',':')).encode()).hexdigest() if ps==200 else None
        payload_changed=bool(fresh_sha and fresh_sha!=base.get('pbp_sha256'))
        rec={'tour':'WTA_CHALLENGER','year':base.get('year',old.get('year')),'match_id':base.get('match_id',old.get('match_id')),'date':base.get('date',old.get('date')),'tournament':base.get('tournament',old.get('tournament')),'player1':base.get('player1',old.get('player1')),'player2':base.get('player2',old.get('player2')),'original_reasons':old_reasons,'fresh_reasons':reasons,'fresh_pbp_sha256':fresh_sha,'stored_pbp_sha256':base.get('pbp_sha256'),'payload_changed':payload_changed,'metrics':metrics,'audited_at_utc':datetime.now(timezone.utc).isoformat()}
        if not reasons:
            if mid in ids: reasons=['DUPLICATE_APPROVED_MATCH_ID']
            elif fresh_sha in hashes: reasons=['DUPLICATE_APPROVED_PBP_HASH']
            else:
                rec.update({'status':'PROMOTED_AFTER_FRESH_REAUDIT','pbp_sha256':fresh_sha})
                promoted.append(rec); ids.add(mid); hashes.add(fresh_sha); class_counts['PROMOTED']+=1; continue
        # Classification does not weaken the firewall; only zero fresh reasons can promote.
        transient=all(r.startswith(('MATCH_DETAIL_HTTP_','PBP_HTTP_')) for r in reasons) if reasons else False
        structural_only=all(('BAD_' in r or 'GAME_COUNTER' in r or 'ILLEGAL_END' in r or r in ('NO_BO3_MATCH_WINNER','NO_SETS') or 'BREAK_FLAG' in r or 'NO_POINTS' in r) for r in reasons) if reasons else False
        if transient:
            rec['status']='FIXABLE_RETRY_NETWORK'; fixable.append(rec); class_counts['FIXABLE_RETRY']+=1
        elif structural_only:
            rec['status']='GENUINELY_INVALID_OR_INCOMPLETE_PBP'; invalid.append(rec); class_counts['INVALID_STRUCTURAL']+=1
        else:
            rec['status']='NEEDS_EXTERNAL_RECHECK'; external.append(rec); class_counts['EXTERNAL_RECHECK']+=1
        for r in reasons: reason_counts[r]+=1
    # Append promotions to the approved metrics namespace only after every firewall is clean.
    if promoted:
        with METRICS.open('a') as f:
            for x in promoted: f.write(json.dumps(x,separators=(',',':'))+'\n')
    for name,rows in [('promoted.jsonl',promoted),('fixable-retry.jsonl',fixable),('invalid-structural.jsonl',invalid),('needs-external-recheck.jsonl',external)]:
        (OUT/name).write_text(''.join(json.dumps(x,separators=(',',':'))+'\n' for x in rows))
    summary={'scope':'WTA Challenger/WTA 125 quarantine re-audit only','input_quarantined':len(quarantined),'promoted_after_fresh_reaudit':len(promoted),'fixable_retry':len(fixable),'genuinely_invalid_or_incomplete':len(invalid),'needs_external_recheck':len(external),'metrics_total_after_promotions':len(existing)+len(promoted),'fresh_failure_reason_counts':dict(reason_counts),'classification_counts':dict(class_counts),'other_tours_excluded':True,'generated_at_utc':datetime.now(timezone.utc).isoformat()}
    (OUT/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    (OUT/'summary.md').write_text('\n'.join(['# WTA Challenger PBP Quarantine Re-audit','',f"- Input quarantined: **{len(quarantined)}**",f"- Promoted after clean fresh re-audit: **{len(promoted)}**",f"- Fixable/retry: **{len(fixable)}**",f"- Genuinely invalid or incomplete PBP: **{len(invalid)}**",f"- Needs external recheck: **{len(external)}**",f"- Metrics total after promotions: **{len(existing)+len(promoted)}**",'- Other tours excluded: **YES**',''])+'\n')
    print(json.dumps(summary,separators=(',',':')))

if __name__=='__main__': main()
