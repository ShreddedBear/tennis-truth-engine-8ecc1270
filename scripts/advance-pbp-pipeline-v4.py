#!/usr/bin/env python3
from __future__ import annotations
import json,sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path('data/audit/verified-pbp-v4');TOURS=('ATP_MAIN','WTA_MAIN');YEARS=range(2012,datetime.now(timezone.utc).year+1)

def load(t,y):
 p=ROOT/t.lower()/str(y)/'summary.json'
 if not p.exists():return None
 try:
  x=json.loads(p.read_text());return x if x.get('verifier_version')==4 else None
 except Exception:return None

def next_batch():
 for t in TOURS:
  for y in YEARS:
   if load(t,y) is None:return t,y
 return None

def main():
 rows=[]
 for t in TOURS:
  for y in YEARS:
   s=load(t,y)
   if s:rows.append(s)
 keys=('historical_matches','pbp_candidates','verified','partial','ambiguous','conflicts','no_pbp','retrieval_failures','access_limitations')
 totals={k:sum(int(r.get(k,0) or 0) for r in rows) for k in keys}
 totals['coverage_pct']=round(100*totals['verified']/totals['historical_matches'],2) if totals['historical_matches'] else 0.0
 nxt=next_batch();progress={'verifier_version':4,'updated_at_utc':datetime.now(timezone.utc).isoformat(),'completed_batches':len(rows),'total_batches':len(TOURS)*len(list(YEARS)),'completed_years':{t:[y for y in YEARS if load(t,y)] for t in TOURS},'totals':totals,'next_resume_position':({'tour':nxt[0],'year':nxt[1]} if nxt else None),'pipeline_complete':nxt is None}
 ROOT.mkdir(parents=True,exist_ok=True);(ROOT/'progress.json').write_text(json.dumps(progress,indent=2)+'\n')
 lines=['# Verified PBP v4 Progress','',f"Updated: {progress['updated_at_utc']}",f"Completed batches: {len(rows)} / {progress['total_batches']}",f"Next resume position: {progress['next_resume_position']}",'']
 for t in TOURS:
  lines += [f'## {t.replace("_"," ")} by year','', '| Year | Historical Matches | PBP Candidates | Verified | Partial | Ambiguous | Conflicts | No PBP | Access Limits | Coverage % |','|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
  for y in YEARS:
   s=load(t,y)
   if s:lines.append(f"| {y} | {s['historical_matches']} | {s['pbp_candidates']} | {s['verified']} | {s['partial']} | {s['ambiguous']} | {s['conflicts']} | {s['no_pbp']} | {s.get('access_limitations',0)} | {s['coverage_pct']:.2f} |")
 lines += ['','## Totals','',f"* {totals['historical_matches']:,} historical matches examined.",f"* {totals['pbp_candidates']:,} PBP candidates were actually found.",f"* {totals['verified']:,} records passed every firewall and were classified VERIFIED.",f"* {totals['partial']:,} remain REVIEW_REQUIRED.",f"* {totals['ambiguous']:,} are AMBIGUOUS_MATCH and are not attached.",f"* {totals['conflicts']:,} are conflicting/unusable and are not attached.",f"* {totals['no_pbp']:,} have no PBP candidate.",f"* {totals['access_limitations']:,} are blocked by source access limitations.",f"* Verified coverage: {totals['coverage_pct']:.2f}%."]
 (ROOT/'progress.md').write_text('\n'.join(lines)+'\n')
 cp={'verifier_version':4,'last_completed_batch':({'tour':rows[-1]['tour'],'year':rows[-1]['year']} if rows else None),'records_attempted':totals['historical_matches'],'verified':totals['verified'],'partial':totals['partial'],'no_pbp':totals['no_pbp'],'ambiguous':totals['ambiguous'],'conflicts':totals['conflicts'],'errors':totals['retrieval_failures'],'access_limitations':totals['access_limitations'],'remaining_batches':progress['total_batches']-len(rows),'exact_next_resume_position':progress['next_resume_position'],'updated_at_utc':progress['updated_at_utc']}
 (ROOT/'checkpoint.json').write_text(json.dumps(cp,indent=2)+'\n')
 if '--next' in sys.argv:print('COMPLETE' if not nxt else f'{nxt[0]} {nxt[1]}')
 else:print(json.dumps(progress,separators=(',',':')))
if __name__=='__main__':main()
