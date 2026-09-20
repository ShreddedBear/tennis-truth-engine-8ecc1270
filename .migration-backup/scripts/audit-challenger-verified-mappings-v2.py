#!/usr/bin/env python3
from __future__ import annotations
import json, hashlib
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'data'/'audit'/'verified-pbp'/'atp_challenger'
OUT=ROOT/'data'/'audit'/'challenger-pbp-firewall-queue'
EXCLUDED=set(range(2018,2023))


def now(): return datetime.now(timezone.utc).isoformat()
def norm(v): return ''.join(ch.lower() for ch in str(v or '') if ch.isalnum())

def main():
    rows=[]; load_errors=[]
    for p in sorted(BASE.glob('*/verified-mappings.json')):
        try: data=json.loads(p.read_text())
        except Exception as e:
            load_errors.append({'path':str(p.relative_to(ROOT)),'error':str(e)}); continue
        if not isinstance(data,list):
            load_errors.append({'path':str(p.relative_to(ROOT)),'error':'not a list'}); continue
        for i,m in enumerate(data):
            if isinstance(m,dict): rows.append((p,i,m))

    result_keys={}; pbp_keys={}; findings=[]; fully_certified=0; provisional=0
    for p,i,m in rows:
        h=m.get('historical') or {}; pr=m.get('pbp_ref') or {}; u=m.get('uniqueness') or {}; v=m.get('validation') or {}
        issues=[]
        year=int(m.get('year') or h.get('year') or 0)
        if m.get('tour')!='ATP_CHALLENGER': issues.append('WRONG_TOUR')
        if year in EXCLUDED: issues.append('HARD_EXCLUDED_YEAR')
        if not v.get('valid'): issues.append('STRUCTURAL_VALIDATION_NOT_PROVEN')
        if int(u.get('forward_candidates',0) or 0)!=1: issues.append('FORWARD_UNIQUENESS_NOT_1')
        if int(u.get('reverse_candidates',0) or 0)!=1: issues.append('REVERSE_UNIQUENESS_NOT_1')
        if not h.get('winner_id') or not h.get('loser_id'): issues.append('PLAYER_IDS_INCOMPLETE')
        if not h.get('tournament') and not h.get('tourney_name'): issues.append('TOURNAMENT_MISSING')
        if not h.get('round'): issues.append('ROUND_MISSING_IN_RESULT')
        if not h.get('surface'): issues.append('SURFACE_MISSING_IN_RESULT')
        if not h.get('score'): issues.append('SCORE_MISSING_IN_RESULT')
        if not pr.get('date'): issues.append('PBP_DATE_MISSING')
        # Critical firewall requirements that v1 did not independently establish.
        ind=m.get('independent_result_verification') or {}
        if not ind.get('exact_match_date'):
            issues.append('EXACT_MATCH_DATE_NOT_INDEPENDENTLY_VERIFIED')
        if not ind.get('round'):
            issues.append('ROUND_NOT_INDEPENDENTLY_CROSSCHECKED')
        if not ind.get('surface'):
            issues.append('SURFACE_NOT_INDEPENDENTLY_CROSSCHECKED')
        if u.get('all_historical_meetings_searched') is not True:
            issues.append('ALL_HISTORICAL_H2H_NOT_SEARCHED')

        ids=sorted([str(h.get('winner_id') or ''),str(h.get('loser_id') or '')])
        if not all(ids): ids=sorted([norm(h.get('winner')),norm(h.get('loser'))])
        rk='|'.join([str(year),str(h.get('tourney_id') or h.get('tournament') or ''),str(h.get('round') or ''),ids[0] if ids else '',ids[1] if len(ids)>1 else '',str(h.get('score') or '')])
        rk=hashlib.sha256(rk.encode()).hexdigest()
        pk=str(pr.get('pbp_sha256') or '')
        if not pk: pk=hashlib.sha256((str(pr.get('source_file'))+'|'+str(pr.get('source_row'))+'|'+str(pr.get('date'))).encode()).hexdigest()
        result_keys.setdefault(rk,[]).append((p,i)); pbp_keys.setdefault(pk,[]).append((p,i))
        status='FULLY_FIREWALL_CERTIFIED' if not issues else 'PROVISIONAL_REAUDIT_REQUIRED'
        fully_certified += status=='FULLY_FIREWALL_CERTIFIED'; provisional += status!='FULLY_FIREWALL_CERTIFIED'
        findings.append({'year':year,'source_path':str(p.relative_to(ROOT)),'mapping_index':i,'status':status,'issues':issues,'result_key':rk,'pbp_key':pk})

    collisions=[]
    for k,v in result_keys.items():
        if len(v)>1: collisions.append({'type':'DUPLICATE_RESULT_KEY','key':k,'count':len(v)})
    for k,v in pbp_keys.items():
        if len(v)>1: collisions.append({'type':'DUPLICATE_PBP_KEY','key':k,'count':len(v)})

    OUT.mkdir(parents=True,exist_ok=True)
    report={'generated_at_utc':now(),'mappings_checked':len(rows),'fully_firewall_certified':fully_certified,'provisional_reaudit_required':provisional,'load_errors':load_errors,'collisions':collisions,'critical_note':'v1 verified mappings are not fully certified unless exact independent match date, round, surface, and all-historical-H2H uniqueness are established.'}
    (OUT/'validity-reaudit-v2-summary.json').write_text(json.dumps(report,indent=2)+'\n')
    (OUT/'validity-reaudit-v2-findings.json').write_text(json.dumps(findings,indent=2)+'\n')
    md=[f"- Mappings checked: **{len(rows)}**",f"- Fully firewall-certified under v2: **{fully_certified}**",f"- Provisional / re-audit required: **{provisional}**",f"- Duplicate/collision findings: **{len(collisions)}**",f"- Load errors: **{len(load_errors)}**",'- Required before promotion: exact independent match date + round + surface + all-historical-H2H uniqueness + forward/reverse uniqueness + structural validity.']
    (OUT/'validity-reaudit-v2-summary.md').write_text('\n'.join(md)+'\n')
    print(json.dumps(report,separators=(',',':')))
    return 0 if not load_errors and not collisions else 2

if __name__=='__main__': raise SystemExit(main())