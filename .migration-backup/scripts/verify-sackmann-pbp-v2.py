#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,hashlib,io,json,re,unicodedata,urllib.request,urllib.error,zipfile
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path
import pandas as pd

VERIFIER_VERSION=2
HIST_BASE='https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main'
PBP_BASE='https://raw.githubusercontent.com/ppaulojr/tennis_pointbypoint/master'
TD_BASE='https://www.tennis-data.co.uk/'
PBP_FILES={'ATP_MAIN':['pbp_matches_atp_main_archive.csv','pbp_matches_atp_main_current.csv'],'WTA_MAIN':['pbp_matches_wta_main_archive.csv','pbp_matches_wta_main_current.csv']}
OUT=Path('data/audit/verified-pbp'); UA='tennis-truth-engine-pbp-verifier/2.0'

def get_bytes(url):
 req=urllib.request.Request(url,headers={'User-Agent':UA})
 with urllib.request.urlopen(req,timeout=90) as r:return r.read()
def get_text(url):return get_bytes(url).decode('utf-8-sig','replace')
def norm_name(s):return re.sub(r'[^a-z0-9]+','',unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower())
def norm_tny(s):
 s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower();s=re.sub(r'\b(atp|wta)\b','',s);s=re.sub(r'20\d{2}','',s);return re.sub(r'[^a-z0-9]+','',s)
def tny_ok(a,b):
 x,y=norm_tny(a),norm_tny(b);return bool(x and y and (x in y or y in x))
def parse_date(s):
 s=str(s or '').strip()
 for f in ('%d %b %y','%Y-%m-%d','%Y%m%d','%d/%m/%Y','%d-%m-%Y','%Y/%m/%d'):
  try:return datetime.strptime(s,f).date().isoformat()
  except ValueError:pass
 try:
  d=pd.to_datetime(s,dayfirst=True,errors='coerce');return '' if pd.isna(d) else d.date().isoformat()
 except Exception:return ''
def clean_score(s):return re.sub(r'\s+',' ',str(s or '').upper().replace('RET','').replace('DEF','').replace('W/O','').strip())
def score_games(s):
 out=[]
 for tok in clean_score(s).split():
  m=re.match(r'^(\d+)-(\d+)',tok)
  if m:out.append((int(m.group(1)),int(m.group(2))))
 return out
def pairkey(a,b):return tuple(sorted((norm_name(a),norm_name(b))))
def round_norm(s):
 x=re.sub(r'[^a-z0-9]+','',str(s or '').lower())
 mp={'f':'f','final':'f','thefinal':'f','sf':'sf','semifinal':'sf','semifinals':'sf','qf':'qf','quarterfinal':'qf','quarterfinals':'qf','r16':'r16','4thround':'r16','fourthround':'r16','r32':'r32','3rdround':'r32','thirdround':'r32','r64':'r64','2ndround':'r64','secondround':'r64','r128':'r128','1stround':'r128','firstround':'r128'}
 return mp.get(x,x)

def game_winner(seq,server,tb=False):
 cur=server;p=[0,0];ended=False
 for ch in seq:
  if ch=='/':
   if not tb:return None
   cur=1-cur;continue
  if ch not in 'SRAD':return None
  w=cur if ch in 'SA' else 1-cur;p[w]+=1
  term=(max(p)>=7 and abs(p[0]-p[1])>=2) if tb else (max(p)>=4 and abs(p[0]-p[1])>=2)
  if ended:return None
  if term:ended=True
 if not ended:return None
 return 0 if p[0]>p[1] else 1

def reconstruct(pbp):
 if not pbp:return {'valid':False,'reason':'EMPTY_PBP'}
 server=0;sets=[];pts=0
 for sb in pbp.strip().split('.'):
  if not sb:return {'valid':False,'reason':'EMPTY_SET'}
  wins=[0,0]
  for g in [x for x in sb.split(';') if x!='']:
   w=game_winner(g,server,'/' in g)
   if w is None:return {'valid':False,'reason':'ILLEGAL_GAME'}
   wins[w]+=1;pts+=sum(c in 'SRAD' for c in g);server=1-server
  a,b=wins
  if not ((max(a,b)>=6 and abs(a-b)>=2) or (a,b) in ((7,6),(6,7))):return {'valid':False,'reason':'ILLEGAL_SET','sets':sets+[wins]}
  sets.append(wins)
 sw=[sum(a>b for a,b in sets),sum(b>a for a,b in sets)]
 if sw[0]==sw[1]:return {'valid':False,'reason':'NO_MATCH_WINNER','sets':sets}
 return {'valid':True,'sets':sets,'winner':0 if sw[0]>sw[1] else 1,'points':pts,'games':sum(sum(x) for x in sets)}

def load_hist(tour,year):
 folder='atp' if tour=='ATP_MAIN' else 'wta';pre='atp' if tour=='ATP_MAIN' else 'wta';url=f'{HIST_BASE}/{folder}/{pre}_matches_{year}.csv'
 rows=list(csv.DictReader(io.StringIO(get_text(url))));out=[]
 for i,r in enumerate(rows):
  level=(r.get('tourney_level') or '').upper()
  if level not in {'G','M','A','F'}:continue
  out.append({'hist_index':i,'tour':tour,'year':year,'tourney_start_date':parse_date(r.get('tourney_date')),'tournament':r.get('tourney_name',''),'surface':r.get('surface',''),'level':level,'round':r.get('round',''),'winner':r.get('winner_name',''),'loser':r.get('loser_name',''),'winner_id':r.get('winner_id',''),'loser_id':r.get('loser_id',''),'score':clean_score(r.get('score','')),'best_of':r.get('best_of',''),'match_num':r.get('match_num',''),'tourney_id':r.get('tourney_id','')})
 return out

def td_candidates(tour,year):
 suffix='w' if tour=='WTA_MAIN' else '';stem=f'{year}{suffix}'
 return [f'{TD_BASE}{year}/{stem}.xlsx',f'{TD_BASE}{year}/{stem}.xls',f'{TD_BASE}{year}/{stem}.csv',f'{TD_BASE}{year}/{stem}.zip']
def read_td(tour,year):
 last=None
 for url in td_candidates(tour,year):
  try:
   data=get_bytes(url)
   if url.endswith('.csv'):df=pd.read_csv(io.BytesIO(data),encoding_errors='ignore')
   elif url.endswith('.zip') or data[:2]==b'PK':
    with zipfile.ZipFile(io.BytesIO(data)) as z:
     names=[n for n in z.namelist() if n.lower().endswith(('.xls','.xlsx','.csv')) and not n.startswith('__MACOSX/')]
     if not names:raise RuntimeError('no spreadsheet in zip')
     raw=z.read(names[0]);df=pd.read_csv(io.BytesIO(raw),encoding_errors='ignore') if names[0].lower().endswith('.csv') else pd.read_excel(io.BytesIO(raw))
   else:df=pd.read_excel(io.BytesIO(data))
   rows=[]
   def pick(r,*names):
    lk={re.sub(r'[^a-z0-9]+','',str(k).lower()):v for k,v in r.items()}
    for n in names:
     v=lk.get(re.sub(r'[^a-z0-9]+','',n.lower()))
     if v is not None and not pd.isna(v) and str(v).strip():return str(v).strip()
    return ''
   for r in df.to_dict(orient='records'):
    d=parse_date(pick(r,'Date'));w=pick(r,'Winner');l=pick(r,'Loser')
    if not d or not w or not l:continue
    sets=[]
    for i in range(1,6):
     a,b=pick(r,f'W{i}'),pick(r,f'L{i}')
     if a and b:
      try:sets.append(f'{int(float(a))}-{int(float(b))}')
      except Exception:sets.append(f'{a}-{b}')
    rows.append({'date':d,'winner':w,'loser':l,'tournament':pick(r,'Tournament'),'surface':pick(r,'Surface'),'round':pick(r,'Round'),'score':' '.join(sets),'source_url':url})
   return rows,url
  except Exception as e:last=e
 raise RuntimeError(f'Tennis-Data retrieval failed: {type(last).__name__ if last else "unknown"}')

def load_pbp(tour,year):
 out=[]
 for fn in PBP_FILES[tour]:
  url=f'{PBP_BASE}/{fn}'
  text=get_text(url)
  for idx,r in enumerate(csv.DictReader(io.StringIO(text))):
   d=parse_date(r.get('date'))
   if not d or int(d[:4])!=year:continue
   expected='ATP' if tour=='ATP_MAIN' else 'WTA'
   if (r.get('tour') or '').upper()!=expected or (r.get('draw') or '').lower()!='main':continue
   raw=r.get('pbp','') or ''
   out.append({'source_file':fn,'source_row':idx+2,'date':d,'tournament':r.get('tny_name',''),'server1':r.get('server1',''),'server2':r.get('server2',''),'winner':r.get('winner',''),'score':clean_score(r.get('score','')),'pbp':raw,'pbp_sha256':hashlib.sha256(raw.encode()).hexdigest()})
 return out

def run(tour,year):
 hist=load_hist(tour,year);pbps=load_pbp(tour,year)
 try:td,td_url=read_td(tour,year);td_error=None
 except Exception as e:td=[];td_url='';td_error=str(e)
 by_pair_h=defaultdict(list);by_pair_td=defaultdict(list)
 for h in hist:by_pair_h[pairkey(h['winner'],h['loser'])].append(h)
 for x in td:by_pair_td[pairkey(x['winner'],x['loser'])].append(x)
 cand_h=defaultdict(list);cand_td=defaultdict(list)
 for pi,p in enumerate(pbps):
  pk=pairkey(p['server1'],p['server2']);pwin=p['server1'] if str(p['winner'])=='1' else p['server2'] if str(p['winner'])=='2' else ''
  for h in by_pair_h.get(pk,[]):
   if norm_name(pwin)!=norm_name(h['winner']):continue
   if p['score'] and h['score'] and p['score']!=h['score']:continue
   if not tny_ok(h['tournament'],p['tournament']):continue
   cand_h[pi].append(h)
  for x in by_pair_td.get(pk,[]):
   if x['date']!=p['date'] or norm_name(x['winner'])!=norm_name(pwin):continue
   if p['score'] and x['score'] and score_games(p['score'])!=score_games(x['score']):continue
   if not tny_ok(x['tournament'],p['tournament']):continue
   cand_td[pi].append(x)

 hist_to_pbp=defaultdict(list)
 for pi,hs in cand_h.items():
  for h in hs:hist_to_pbp[h['hist_index']].append(pi)
 used_h=set();used_p=set();counts=Counter();verified=[];records=[]
 for h in hist:
  his=h['hist_index'];pis=hist_to_pbp.get(his,[])
  # Independent exact-date source is mandatory. Missing TD is retrieval failure, not verification.
  eligible=[]
  for pi in pis:
   tds=cand_td.get(pi,[])
   if len(tds)!=1:continue
   x=tds[0]
   if h['surface'] and x['surface'] and h['surface'].lower()!=x['surface'].lower():continue
   rn=round_norm(x['round']);hr=round_norm(h['round'])
   if rn and hr and rn!=hr:continue
   eligible.append(pi)
  if td_error:
   st='RETRIEVAL_FAILED';counts[st]+=1;records.append({'hist':h,'status':st,'reason':td_error});continue
  if not eligible:
   st='NO_PBP_AVAILABLE' if not pis else 'REVIEW_REQUIRED';counts[st]+=1;records.append({'hist':h,'status':st,'candidate_count':len(pis)});continue
  if len(eligible)!=1:
   st='AMBIGUOUS_MATCH';counts[st]+=1;records.append({'hist':h,'status':st,'candidate_count':len(eligible)});continue
  pi=eligible[0];p=pbps[pi]
  # Reverse verification: this PBP must independently map to exactly one canonical historical row and one exact-date TD row.
  rev=[hh for hh in cand_h.get(pi,[]) if pi in hist_to_pbp.get(hh['hist_index'],[]) and len(cand_td.get(pi,[]))==1]
  if len(rev)!=1:
   st='AMBIGUOUS_MATCH';counts[st]+=1;records.append({'hist':h,'status':st,'reverse_candidate_count':len(rev)});continue
  if his in used_h or pi in used_p:
   st='PBP_CONFLICT';counts[st]+=1;records.append({'hist':h,'status':st,'reason':'DUPLICATE_PROTECTION'});continue
  rec=reconstruct(p['pbp'])
  if not rec.get('valid'):
   st='PBP_UNUSABLE';counts[st]+=1;records.append({'hist':h,'status':st,'validation':rec});continue
  pg=[tuple(x) for x in rec['sets']]
  if norm_name(h['winner'])==norm_name(p['server2']):pg=[(b,a) for a,b in pg]
  hs=score_games(h['score'])
  if pg!=hs:
   st='PBP_CONFLICT';counts[st]+=1;records.append({'hist':h,'status':st,'reason':'RECONSTRUCTED_SCORE_MISMATCH','reconstructed':pg,'historical':hs});continue
  pwi=0 if norm_name(h['winner'])==norm_name(p['server1']) else 1
  if rec['winner']!=pwi:
   st='PBP_CONFLICT';counts[st]+=1;records.append({'hist':h,'status':st,'reason':'RECONSTRUCTED_WINNER_MISMATCH'});continue
  used_h.add(his);used_p.add(pi);counts['RESULT_VERIFIED_PBP']+=1
  x=cand_td[pi][0]
  m={'tour':tour,'year':year,'historical':h,'exact_match_date':p['date'],'independent_result_verification':x,'pbp_ref':{k:p[k] for k in ('source_file','source_row','date','tournament','server1','server2','winner','score','pbp_sha256')},'validation':rec,'uniqueness':{'same_year_historical_meetings':len(by_pair_h[pairkey(h['winner'],h['loser'])]),'forward_candidates':1,'reverse_candidates':1,'independent_exact_date_candidates':1},'trust_level':'LEVEL_1_RESULT_VERIFIED_PBP','verifier_version':VERIFIER_VERSION}
  verified.append(m);records.append({'hist':h,'status':'RESULT_VERIFIED_PBP','pbp_ref':m['pbp_ref'],'trust_level':m['trust_level']})

 orphan=[]
 for i,p in enumerate(pbps):
  if i in used_p:continue
  if not cand_h.get(i):st='NO_MATCH'
  elif len(cand_h[i])>1 or len(cand_td.get(i,[]))>1:st='AMBIGUOUS_MATCH'
  else:st='REVIEW_REQUIRED'
  orphan.append({'pbp_ref':{k:p[k] for k in ('source_file','source_row','date','tournament','server1','server2','winner','score','pbp_sha256')},'status':st})
 total=len(hist);v=counts['RESULT_VERIFIED_PBP']
 summary={'verifier_version':VERIFIER_VERSION,'tour':tour,'year':year,'historical_matches':total,'pbp_candidates':len(pbps),'verified':v,'partial':counts['REVIEW_REQUIRED'],'ambiguous':counts['AMBIGUOUS_MATCH'],'conflicts':counts['PBP_CONFLICT']+counts['PBP_UNUSABLE'],'no_pbp':counts['NO_PBP_AVAILABLE'],'retrieval_failures':counts['RETRIEVAL_FAILED'],'coverage_pct':round(100*v/total,2) if total else 0.0,'orphan_pbp':len(orphan),'independent_date_source':td_url or None,'all_time_meeting_search':'NOT_YET_GLOBAL_INDEXED','generated_at_utc':datetime.now(timezone.utc).isoformat()}
 d=OUT/tour.lower()/str(year);d.mkdir(parents=True,exist_ok=True)
 for fn,obj in [('summary.json',summary),('verified-mappings.json',verified),('records.json',records),('orphan-pbp.json',orphan)]: (d/fn).write_text(json.dumps(obj,indent=2)+'\n')
 cp={'verifier_version':VERIFIER_VERSION,'last_processed_tour':tour,'last_processed_year':year,'records_attempted':total,'verified':v,'partial':summary['partial'],'no_pbp':summary['no_pbp'],'ambiguous':summary['ambiguous'],'conflicts':summary['conflicts'],'errors':summary['retrieval_failures'],'exact_next_resume_position':None,'updated_at_utc':summary['generated_at_utc']};(OUT/'checkpoint.json').write_text(json.dumps(cp,indent=2)+'\n')
 print('BATCH_RESULT '+json.dumps(summary,separators=(',',':')),flush=True)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--tour',choices=['ATP_MAIN','WTA_MAIN'],required=True);ap.add_argument('--year',type=int,required=True);a=ap.parse_args();run(a.tour,a.year)
if __name__=='__main__':main()
