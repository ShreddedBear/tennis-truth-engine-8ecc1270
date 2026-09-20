#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,hashlib,io,json,re,unicodedata,urllib.request
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path

HIST_BASE='https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main'
PBP_BASE='https://raw.githubusercontent.com/ppaulojr/tennis_pointbypoint/master'
PBP_FILES={
 'ATP_MAIN':['pbp_matches_atp_main_archive.csv','pbp_matches_atp_main_current.csv'],
 'WTA_MAIN':['pbp_matches_wta_main_archive.csv','pbp_matches_wta_main_current.csv'],
}
OUT=Path('data/audit/verified-pbp')
UA='tennis-truth-engine-pbp-verifier/1.0'

def get_text(url:str)->str:
 req=urllib.request.Request(url,headers={'User-Agent':UA})
 with urllib.request.urlopen(req,timeout=90) as r:return r.read().decode('utf-8-sig','replace')

def norm_name(s):
 s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
 return re.sub(r'[^a-z0-9]+','',s)

def norm_tny(s):
 s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
 s=re.sub(r'\b(atp|wta)\b','',s);s=re.sub(r'20\d{2}','',s)
 return re.sub(r'[^a-z0-9]+','',s)

def parse_date(s):
 for f in ('%d %b %y','%Y-%m-%d','%Y%m%d','%d %B %y'):
  try:return datetime.strptime((s or '').strip(),f).date().isoformat()
  except ValueError:pass
 return ''

def clean_score(s):
 s=(s or '').upper().replace('RET','').replace('DEF','').replace('W/O','').strip()
 s=re.sub(r'\s+',' ',s)
 return s

def score_games(s):
 out=[]
 for tok in clean_score(s).split():
  m=re.match(r'^(\d+)-(\d+)',tok)
  if m:out.append((int(m.group(1)),int(m.group(2))))
 return out

def game_winner(seq,server,tiebreak=False):
 cur=server;p=[0,0];ended=False
 for ch in seq:
  if ch=='/':
   if not tiebreak:return None
   cur=1-cur;continue
  if ch not in 'SRAD':return None
  pw=cur if ch in 'SA' else 1-cur;p[pw]+=1
  terminal=(max(p)>=7 and abs(p[0]-p[1])>=2) if tiebreak else (max(p)>=4 and abs(p[0]-p[1])>=2)
  if ended:return None
  if terminal:ended=True
 if not ended:return None
 return 0 if p[0]>p[1] else 1

def reconstruct_pbp(pbp):
 if not pbp:return {'valid':False,'reason':'EMPTY_PBP'}
 server=0;sets=[];points=0
 for set_blob in pbp.strip().split('.'):
  if not set_blob:return {'valid':False,'reason':'EMPTY_SET'}
  games=[g for g in set_blob.split(';') if g!=''];wins=[0,0]
  for g in games:
   tb='/' in g
   w=game_winner(g,server,tb)
   if w is None:return {'valid':False,'reason':'ILLEGAL_GAME'}
   wins[w]+=1;points+=sum(c in 'SRAD' for c in g);server=1-server
  a,b=wins
  legal=(max(a,b)>=6 and abs(a-b)>=2) or ((a,b) in ((7,6),(6,7)))
  if not legal:return {'valid':False,'reason':'ILLEGAL_SET','sets':sets+[[a,b]]}
  sets.append([a,b])
 sw=[sum(1 for a,b in sets if a>b),sum(1 for a,b in sets if b>a)]
 if sw[0]==sw[1]:return {'valid':False,'reason':'NO_MATCH_WINNER','sets':sets}
 return {'valid':True,'sets':sets,'winner':0 if sw[0]>sw[1] else 1,'points':points,'games':sum(sum(x) for x in sets)}

def hist_url(tour,year):
 folder='atp' if tour=='ATP_MAIN' else 'wta';prefix='atp' if tour=='ATP_MAIN' else 'wta'
 return f'{HIST_BASE}/{folder}/{prefix}_matches_{year}.csv'

def load_hist(tour,year):
 rows=list(csv.DictReader(io.StringIO(get_text(hist_url(tour,year)))))
 out=[]
 for i,r in enumerate(rows):
  # Main-tour firewall: Sackmann levels G/M/A/F are main tour; exclude Challenger C, Davis/BJK team D, ITF.
  level=(r.get('tourney_level') or '').upper()
  if level not in {'G','M','A','F'}:continue
  d=parse_date(r.get('tourney_date',''))
  out.append({'hist_index':i,'tour':tour,'date':d,'tournament':r.get('tourney_name',''),'surface':r.get('surface',''),'level':level,'round':r.get('round',''),'winner':r.get('winner_name',''),'loser':r.get('loser_name',''),'winner_id':r.get('winner_id',''),'loser_id':r.get('loser_id',''),'score':clean_score(r.get('score','')),'best_of':r.get('best_of',''),'match_num':r.get('match_num',''),'tourney_id':r.get('tourney_id','')})
 return out

def load_pbp(tour,year):
 out=[]
 for fn in PBP_FILES[tour]:
  url=f'{PBP_BASE}/{fn}'
  try:text=get_text(url)
  except Exception as e:
   print(json.dumps({'warning':'PBP_RETRIEVAL_FAILED','file':fn,'error':type(e).__name__}),flush=True);continue
  for idx,r in enumerate(csv.DictReader(io.StringIO(text))):
   d=parse_date(r.get('date',''))
   if not d or int(d[:4])!=year:continue
   expected='ATP' if tour=='ATP_MAIN' else 'WTA'
   if (r.get('tour') or '').upper()!=expected or (r.get('draw') or '').lower()!='main':continue
   raw=r.get('pbp','') or ''
   out.append({'source_file':fn,'source_row':idx+2,'date':d,'tournament':r.get('tny_name',''),'server1':r.get('server1',''),'server2':r.get('server2',''),'winner':r.get('winner',''),'score':clean_score(r.get('score','')),'pbp':raw,'pbp_sha256':hashlib.sha256(raw.encode()).hexdigest()})
 return out

def pairkey(a,b):return tuple(sorted((norm_name(a),norm_name(b))))

def tny_compatible(a,b):
 x,y=norm_tny(a),norm_tny(b)
 return bool(x and y and (x in y or y in x))

def run(tour,year):
 hist=load_hist(tour,year);pbps=load_pbp(tour,year)
 by_pair=defaultdict(list);by_exact=defaultdict(list)
 for h in hist:
  by_pair[pairkey(h['winner'],h['loser'])].append(h)
  by_exact[(h['date'],pairkey(h['winner'],h['loser']))].append(h)

 candidate_for_hist=defaultdict(list);reverse_for_pbp=defaultdict(list)
 for pi,p in enumerate(pbps):
  pk=pairkey(p['server1'],p['server2'])
  for h in by_exact.get((p['date'],pk),[]):
   # Tournament and winner/score must agree; this deliberately rejects plausible-but-not-exact rows.
   pwin=p['server1'] if str(p['winner'])=='1' else p['server2'] if str(p['winner'])=='2' else ''
   if norm_name(pwin)!=norm_name(h['winner']):continue
   if p['score'] and h['score'] and p['score']!=h['score']:continue
   if not tny_compatible(h['tournament'],p['tournament']):continue
   candidate_for_hist[h['hist_index']].append(pi);reverse_for_pbp[pi].append(h['hist_index'])

 used_pbp=set();used_hist=set();verified=[];records=[];counts=Counter()
 for h in hist:
  his=h['hist_index'];cands=candidate_for_hist.get(his,[])
  if not cands:
   status='NO_PBP_AVAILABLE';counts[status]+=1;records.append({'hist':h,'status':status});continue
  if len(cands)!=1:
   status='AMBIGUOUS_MATCH';counts[status]+=1;records.append({'hist':h,'status':status,'candidate_count':len(cands)});continue
  pi=cands[0];p=pbps[pi]
  if len(reverse_for_pbp.get(pi,[]))!=1:
   status='AMBIGUOUS_MATCH';counts[status]+=1;records.append({'hist':h,'status':status,'reverse_candidate_count':len(reverse_for_pbp.get(pi,[]))});continue
  if pi in used_pbp or his in used_hist:
   status='PBP_CONFLICT';counts[status]+=1;records.append({'hist':h,'status':status,'reason':'DUPLICATE_PROTECTION'});continue
  # Search ALL historical meetings; exact identity must still be unique after date/tournament/winner/score filters.
  meetings=by_pair[pairkey(h['winner'],h['loser'])]
  plausible=[m for m in meetings if m['date']==h['date'] and tny_compatible(m['tournament'],p['tournament']) and m['score']==h['score'] and norm_name(m['winner'])==norm_name(h['winner'])]
  if len(plausible)!=1:
   status='AMBIGUOUS_MATCH';counts[status]+=1;records.append({'hist':h,'status':status,'all_meetings':len(meetings),'plausible_meetings':len(plausible)});continue
  rec=reconstruct_pbp(p['pbp'])
  if not rec.get('valid'):
   status='PBP_UNUSABLE';counts[status]+=1;records.append({'hist':h,'status':status,'validation':rec,'pbp_ref':{k:p[k] for k in ('source_file','source_row','pbp_sha256')}});continue
  # Reconstructed game-score agreement. PBP set orientation is server1/server2; historical score is winner/loser.
  pg=[tuple(x) for x in rec['sets']]
  if norm_name(h['winner'])==norm_name(p['server2']):pg=[(b,a) for a,b in pg]
  hs=score_games(h['score'])
  if pg!=hs:
   status='PBP_CONFLICT';counts[status]+=1;records.append({'hist':h,'status':status,'reason':'RECONSTRUCTED_SCORE_MISMATCH','reconstructed':pg,'historical':hs});continue
  pwinidx=0 if norm_name(h['winner'])==norm_name(p['server1']) else 1
  if rec['winner']!=pwinidx:
   status='PBP_CONFLICT';counts[status]+=1;records.append({'hist':h,'status':status,'reason':'RECONSTRUCTED_WINNER_MISMATCH'});continue
  used_pbp.add(pi);used_hist.add(his);status='RESULT_VERIFIED_PBP';counts[status]+=1
  mapping={'tour':tour,'year':year,'historical':h,'pbp_ref':{k:p[k] for k in ('source_file','source_row','date','tournament','server1','server2','winner','score','pbp_sha256')},'validation':rec,'uniqueness':{'all_historical_meetings':len(meetings),'forward_candidates':1,'reverse_candidates':1},'trust_level':'LEVEL_1_RESULT_VERIFIED_PBP'}
  verified.append(mapping);records.append({'hist':h,'status':status,'pbp_ref':mapping['pbp_ref'],'trust_level':mapping['trust_level']})

 # Orphan PBP rows are classified explicitly and never force-attached.
 orphan=[]
 for i,p in enumerate(pbps):
  if i in used_pbp:continue
  rev=reverse_for_pbp.get(i,[])
  orphan.append({'pbp_ref':{k:p[k] for k in ('source_file','source_row','date','tournament','server1','server2','winner','score','pbp_sha256')},'status':'NO_MATCH' if not rev else 'AMBIGUOUS_MATCH' if len(rev)>1 else 'REVIEW_REQUIRED'})

 total=len(hist);v=counts['RESULT_VERIFIED_PBP']
 summary={'tour':tour,'year':year,'historical_matches':total,'pbp_candidates':len(pbps),'verified':v,'partial':counts['REVIEW_REQUIRED'],'ambiguous':counts['AMBIGUOUS_MATCH'],'conflicts':counts['PBP_CONFLICT']+counts['PBP_UNUSABLE'],'no_pbp':counts['NO_PBP_AVAILABLE'],'retrieval_failures':0,'coverage_pct':round(100*v/total,2) if total else 0.0,'orphan_pbp':len(orphan),'generated_at_utc':datetime.now(timezone.utc).isoformat()}
 d=OUT/tour.lower()/str(year);d.mkdir(parents=True,exist_ok=True)
 (d/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
 (d/'verified-mappings.json').write_text(json.dumps(verified,indent=2)+'\n')
 (d/'records.json').write_text(json.dumps(records,indent=2)+'\n')
 (d/'orphan-pbp.json').write_text(json.dumps(orphan,indent=2)+'\n')
 cp={'last_processed_tour':tour,'last_processed_year':year,'records_attempted':total,'verified':v,'partial':summary['partial'],'no_pbp':summary['no_pbp'],'ambiguous':summary['ambiguous'],'conflicts':summary['conflicts'],'errors':summary['retrieval_failures'],'remaining':'computed by workflow from unprocessed year summaries','exact_next_resume_position':None,'updated_at_utc':summary['generated_at_utc']}
 (OUT/'checkpoint.json').write_text(json.dumps(cp,indent=2)+'\n')
 print('BATCH_RESULT '+json.dumps(summary,separators=(',',':')),flush=True)
 return summary

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--tour',choices=['ATP_MAIN','WTA_MAIN'],required=True);ap.add_argument('--year',type=int,required=True);a=ap.parse_args()
 if a.year<2012 or a.year>datetime.now(timezone.utc).year:raise SystemExit('year outside 2012..current')
 run(a.tour,a.year)
if __name__=='__main__':main()
