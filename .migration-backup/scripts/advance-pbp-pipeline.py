#!/usr/bin/env python3
from __future__ import annotations
import json,sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path('data/audit/verified-pbp');TOURS=('ATP_MAIN','WTA_MAIN');YEARS=range(2012,datetime.now(timezone.utc).year+1);REQUIRED_VERSION=3

def load(t,y):
 p=ROOT/t.lower()/str(y)/'summary.json'
 if not p.exists():return None
 try:
  s=json.loads(p.read_text());return s if int(s.get('verifier_version',0))>=REQUIRED_VERSION else None
 except Exception:return None

def next_batch():
 for t in TOURS:
  for y in YEARS:
   if load(t,y) is None:return t,y
 return None

def aggregate():
 rows=[]
 for t in TOURS:
  for y in YEARS:
   s=load(t,y)
   if s:rows.append(s)
 totals={k:0 for k in ('historical_matches','pbp_candidates','verified','partial','ambiguous','conflicts','no_pbp','retrieval_failures')}
 for r in rows:
  for k in totals:totals[k]+=int(r.get(k,0) or 0)
 totals['coverage_pct']=round(100*totals['verified']/totals['historical_matches'],2) if totals['historical_matches'] else 0.0
 nxt=next_batch();completed={t:[y for y in YEARS if load(t,y)] for t in TOURS}
 progress={'verifier_version':REQUIRED_VERSION,'updated_at_utc':datetime.now(timezone.utc).isoformat(),'completed_batches':len(rows),'total_batches':len(TOURS)*len(list(YEARS)),'completed_years':completed,'partially_processed_years':{t:[] for t in TOURS},'totals':totals,'next_resume_position':({'tour':nxt[0],'year':nxt[1]} if nxt else None),'pipeline_complete':nxt is None}
 ROOT.mkdir(parents=True,exist_ok=True);(ROOT/'progress.json').write_text(json.dumps(progress,indent=2)+'\n')
 lines=['# Verified PBP Pipeline Progress','',f"Verifier version: {REQUIRED_VERSION}",f"Updated: {progress['updated_at_utc']}",'',f"Completed batches: {progress['completed_batches']} / {progress['total_batches']}",f"Next resume position: {progress['next_resume_position']}",'','## ATP MAIN by year','', '| Year | Historical Matches | PBP Candidates | Verified | Partial | Ambiguous | Conflicts | No PBP | Coverage % |','|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
 for t in TOURS:
  if t=='WTA_MAIN':lines += ['','## WTA MAIN by year','', '| Year | Historical Matches | PBP Candidates | Verified | Partial | Ambiguous | Conflicts | No PBP | Coverage % |','|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
  for y in YEARS:
   s=load(t,y)
   if s:lines.append(f"| {y} | {s['historical_matches']} | {s['pbp_candidates']} | {s['verified']} | {s['partial']} | {s['ambiguous']} | {s['conflicts']} | {s['no_pbp']} | {s['coverage_pct']:.2f} |")
 lines += ['','## Totals','',f"Total examined: {totals['historical_matches']}",f"Total correct/verified: {totals['verified']}",f"Total partial: {totals['partial']}",f"Total rejected because incorrect/conflicting: {totals['conflicts']}",f"Total ambiguous: {totals['ambiguous']}",f"Total without PBP: {totals['no_pbp']}",f"Total retrieval failures: {totals['retrieval_failures']}",f"Total PBP attached: {totals['verified']}",f"Total still unresolved: {totals['partial']+totals['ambiguous']+totals['conflicts']+totals['no_pbp']+totals['retrieval_failures']}",f"Verified coverage %: {totals['coverage_pct']:.2f}"]
 (ROOT/'progress.md').write_text('\n'.join(lines)+'\n');return progress

if __name__=='__main__':
 p=aggregate();n=p['next_resume_position'];print(('COMPLETE' if not n else f"{n['tour']} {n['year']}") if '--next' in sys.argv else json.dumps(p,separators=(',',':')))
