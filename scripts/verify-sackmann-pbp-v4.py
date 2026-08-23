#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,hashlib,io,json,re,unicodedata,urllib.request,zipfile
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path
import pandas as pd

VERIFIER_VERSION=4
ROOT=Path('data/audit/verified-pbp-v4')
HIST_BASE='https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main'
PBP_BASE='https://raw.githubusercontent.com/ppaulojr/tennis_pointbypoint/master'
TD_BASE='https://www.tennis-data.co.uk'
PBP_FILES={
 'ATP_MAIN':['pbp_matches_atp_main_archive.csv','pbp_matches_atp_main_current.csv'],
 'WTA_MAIN':['pbp_matches_wta_main_archive.csv','pbp_matches_wta_main_current.csv'],
}
MAIN_LEVELS={'G','M','A','F'}
UA='tennis-truth-engine-pbp-v4/1.0'

def fetch_bytes(url,timeout=90):
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'*/*'})
 with urllib.request.urlopen(req,timeout=timeout) as r:return r.read()
def fetch_text(url):return fetch_bytes(url).decode('utf-8-sig','replace')
def norm_name(v):return re.sub(r'[^a-z0-9]+','',unicodedata.normalize('NFKD',str(v or '')).encode('ascii','ignore').decode().lower())
def norm_tny(v):
 s=unicodedata.normalize('NFKD',str(v or '')).encode('ascii','ignore').decode().lower();s=re.sub(r'\b(atp|wta)\b','',s);s=re.sub(r'20\d{2}','',s)
 return re.sub(r'[^a-z0-9]+','',s)
def tny_ok(a,b):
 x,y=norm_tny(a),norm_tny(b);return bool(x and y and (x in y or y in x))
def pairkey(a,b):return tuple(sorted((norm_name(a),norm_name(b))))
def parse_date(v):
 s=str(v or '').strip()
 for f in ('%d %b %y','%Y-%m-%d','%Y%m%d','%d/%m/%Y','%d-%m-%Y','%Y/%m/%d'):
  try:return datetime.strptime(s,f).date().isoformat()
  except ValueError:pass
 try:
  d=pd.to_datetime(s,dayfirst=True,errors='coerce');return '' if pd.isna(d) else d.date().isoformat()
 except Exception:return ''
def clean_score(v):return re.sub(r'\s+',' ',str(v or '').upper().replace('RET','').replace('DEF','').replace('W/O','').strip())
def score_games(v):
 out=[]
 for tok in clean_score(v).split():
  m=re.match(r'^(\d+)-(\d+)',tok)
  if m:out.append((int(m.group(1)),int(m.group(2))))
 return out
def round_norm(v):
 x=re.sub(r'[^a-z0-9]+','',str(v or '').lower())
 return {'f':'f','final':'f','sf':'sf','semifinal':'sf','semifinals':'sf','qf':'qf','quarterfinal':'qf','quarterfinals':'qf','r16':'r16','4thround':'r16','fourthround':'r16','r32':'r32','3rdround':'r32','thirdround':'r32','r64':'r64','2ndround':'r64','secondround':'r64','r128':'r128','1stround':'r128','firstround':'r128'}.get(x,x)

def game_winner(seq,server,tb=False):
 cur=server;p=[0,0];ended=False
 for ch in seq:
  if ch=='/':
   if not tb:return None
   cur=1-cur;continue
  if ch not in 'SRAD':return None
  w=cur if ch in 'SA' else 1-cur;p[w]+=1
  terminal=(max(p)>=7 and abs(p[0]-p[1])>=2) if tb else (max(p)>=4 and abs(p[0]-p[1])>=2)
  if ended:return None
  if terminal:ended=True
 if not ended:return None
 return 0 if p[0]>p[1] else 1

def reconstruct(pbp):
 if not pbp:return {'valid':False,'reason':'EMPTY_PBP'}
 server=0;sets=[];points=0
 for blob in pbp.strip().split('.'):
  if not blob:return {'valid':False,'reason':'EMPTY_SET'}
  wins=[0,0]
  for game in [x for x in blob.split(';') if x]:
   w=game_winner(game,server,'/' in game)
   if w is None:return {'valid':False,'reason':'ILLEGAL_GAME'}
   wins[w]+=1;points+=sum(c in 'SRAD' for c in game);server=1-server
  a,b=wins
  if not ((max(a,b)>=6 and abs(a-b)>=2) or (a,b) in ((7,6),(6,7))):return {'valid':False,'reason':'ILLEGAL_SET','sets':sets+[wins]}
  sets.append(wins)
 sw=[sum(a>b for a,b in sets),sum(b>a for a,b in sets)]
 if sw[0]==sw[1]:return {'valid':False,'reason':'NO_MATCH_WINNER','sets':sets}
 return {'valid':True,'sets':sets,'winner':0 if sw[0]>sw[1] else 1,'points':points,'games':sum(sum(s) for s in sets)}

def hist_url(tour,year):
 p='atp' if tour=='ATP_MAIN' else 'wta';return f'{HIST_BASE}/{p}/{p}_matches_{year}.csv'
def load_hist_year(tour,year):
 rows=list(csv.DictReader(io.StringIO(fetch_text(hist_url(tour,year)))));out=[]
 for i,r in enumerate(rows):
  level=(r.get('tourney_level') or '').upper()
  if level not in MAIN_LEVELS:continue
  out.append({'hist_index':i,'tour':tour,'year':year,'tourney_start_date':parse_date(r.get('tourney_date')),'tournament':r.get('tourney_name',''),'surface':r.get('surface',''),'level':level,'round':r.get('round',''),'winner':r.get('winner_name',''),'loser':r.get('loser_name',''),'winner_id':r.get('winner_id',''),'loser_id':r.get('loser_id',''),'score':clean_score(r.get('score','')),'best_of':r.get('best_of',''),'match_num':r.get('match_num',''),'tourney_id':r.get('tourney_id','')})
 return out

def load_all_meeting_counts(tour):
 counts=Counter();current=datetime.now(timezone.utc).year
 start=1968
 for y in range(start,current+1):
  try:
   for h in load_hist_year(tour,y):counts[pairkey(h['winner'],h['loser'])]+=1
  except Exception:continue
 return counts

def load_pbp(tour,year):
 out=[];errors=[]
 for fn in PBP_FILES[tour]:
  try:text=fetch_text(f'{PBP_BASE}/{fn}')
  except Exception as e:errors.append({'source':fn,'error':type(e).__name__});continue
  for idx,r in enumerate(csv.DictReader(io.StringIO(text))):
   d=parse_date(r.get('date'))
   if not d or int(d[:4])!=year:continue
   expected='ATP' if tour=='ATP_MAIN' else 'WTA'
   if (r.get('tour') or '').upper()!=expected or (r.get('draw') or '').lower()!='main':continue
   raw=r.get('pbp','') or ''
   out.append({'source_file':fn,'source_row':idx+2,'date':d,'tournament':r.get('tny_name',''),'server1':r.get('server1',''),'server2':r.get('server2',''),'winner':r.get('winner',''),'score':clean_score(r.get('score','')),'pbp':raw,'pbp_sha256':hashlib.sha256(raw.encode()).hexdigest()})
 return out,errors

def td_candidates(tour,year):
 suf='w' if tour=='WTA_MAIN' else '';stem=f'{year}{suf}'
 return [f'{TD_BASE}/{year}/{stem}.xlsx',f'{TD_BASE}/{year}/{stem}.xls',f'{TD_BASE}/{year}/{stem}.csv',f'{TD_BASE}/{year}/{stem}.zip']
def read_table(data,url):
 if url.endswith('.csv'):return pd.read_csv(io.BytesIO(data),encoding_errors='ignore')
 if url.endswith('.zip') or data[:2]==b'PK':
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   names=[n for n in z.namelist() if n.lower().endswith(('.xls','.xlsx','.csv')) and not n.startswith('__MACOSX/')]
   if not names:raise RuntimeError('NO_TABLE_IN_ZIP')
   raw=z.read(names[0]);return pd.read_csv(io.BytesIO(raw),encoding_errors='ignore') if names[0].lower().endswith('.csv') else pd.read_excel(io.BytesIO(raw))
 return pd.read_excel(io.BytesIO(data))
def read_td(tour,year):
 errs=[]
 for url in td_candidates(tour,year):
  try:
   df=read_table(fetch_bytes(url),url);rows=[]
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
   if rows:return rows,url,None
  except Exception as e:errs.append(f'{url}:{type(e).__name__}')
 return [],'', '; '.join(errs) or 'NO_INDEPENDENT_RESULT_SOURCE'

def run(tour,year):
 hist=load_hist_year(tour,year);pbps,pbp_errors=load_pbp(tour,year);td,td_url,td_error=read_td(tour,year);meeting_counts=load_all_meeting_counts(tour)
 by_pair_h=defaultdict(list);by_pair_td=defaultdict(list)
 for h in hist:by_pair_h[pairkey(h['winner'],h['loser'])].append(h)
 for x in td:by_pair_td[pairkey(x['winner'],x['loser'])].append(x)
 cand_h=defaultdict(list);cand_td=defaultdict(list)
 for pi,p in enumerate(pbps):
  pk=pairkey(p['server1'],p['server2']);pwin=p['server1'] if str(p['winner'])=='1' else p['server2'] if str(p['winner'])=='2' else ''
  for h in by_pair_h.get(pk,[]):
   if norm_name(pwin)!=norm_name(h['winner']):continue
   if p['score'] and h['score'] and score_games(p['score'])!=score_games(h['score']):continue
   if not tny_ok(h['tournament'],p['tournament']):continue
   cand_h[pi].append(h)
  for x in by_pair_td.get(pk,[]):
   if x['date']!=p['date'] or norm_name(x['winner'])!=norm_name(pwin):continue
   if p['score'] and x['score'] and score_games(p['score'])!=score_games(x['score']):continue
   if not tny_ok(x['tournament'],p['tournament']):continue
   cand_td[pi].append(x)
 hist_to_p=defaultdict(list)
 for pi,hs in cand_h.items():
  for h in hs:hist_to_p[h['hist_index']].append(pi)
 used_h=set();used_p=set();counts=Counter();records=[];verified=[]
 for h in hist:
  his=h['hist_index'];pis=hist_to_p.get(his,[])
  if not pis:
   st='NO_PBP_AVAILABLE';counts[st]+=1;records.append({'hist':h,'status':st});continue
  if td_error:
   st='ACCESS_LIMITATION';counts[st]+=1;records.append({'hist':h,'status':st,'reason':td_error,'candidate_count':len(pis)});continue
  eligible=[]
  for pi in pis:
   tds=cand_td.get(pi,[])
   if len(tds)!=1:continue
   x=tds[0]
   if h['surface'] and x['surface'] and h['surface'].lower()!=x['surface'].lower():continue
   if round_norm(h['round']) and round_norm(x['round']) and round_norm(h['round'])!=round_norm(x['round']):continue
   eligible.append(pi)
  if not eligible:
   st='REVIEW_REQUIRED';counts[st]+=1;records.append({'hist':h,'status':st,'candidate_count':len(pis)});continue
  if len(eligible)!=1:
   st='AMBIGUOUS_MATCH';counts[st]+=1;records.append({'hist':h,'status':st,'candidate_count':len(eligible)});continue
  pi=eligible[0];p=pbps[pi]
  rev=[hh for hh in cand_h.get(pi,[]) if len(cand_td.get(pi,[]))==1]
  if len(rev)!=1:
   st='AMBIGUOUS_MATCH';counts[st]+=1;records.append({'hist':h,'status':st,'reverse_candidate_count':len(rev)});continue
  if his in used_h or pi in used_p:
   st='PBP_CONFLICT';counts[st]+=1;records.append({'hist':h,'status':st,'reason':'DUPLICATE_PROTECTION'});continue
  rec=reconstruct(p['pbp'])
  if not rec.get('valid'):
   st='PBP_UNUSABLE';counts[st]+=1;records.append({'hist':h,'status':st,'validation':rec});continue
  pg=[tuple(x) for x in rec['sets']]
  if norm_name(h['winner'])==norm_name(p['server2']):pg=[(b,a) for a,b in pg]
  if pg!=score_games(h['score']):
   st='PBP_CONFLICT';counts[st]+=1;records.append({'hist':h,'status':st,'reason':'RECONSTRUCTED_SCORE_MISMATCH','reconstructed':pg,'historical':score_games(h['score'])});continue
  pwi=0 if norm_name(h['winner'])==norm_name(p['server1']) else 1
  if rec['winner']!=pwi:
   st='PBP_CONFLICT';counts[st]+=1;records.append({'hist':h,'status':st,'reason':'RECONSTRUCTED_WINNER_MISMATCH'});continue
  used_h.add(his);used_p.add(pi);counts['RESULT_VERIFIED_PBP']+=1;x=cand_td[pi][0]
  mapping={'tour':tour,'year':year,'historical':h,'exact_match_date':p['date'],'independent_result_verification':x,'pbp_ref':{k:p[k] for k in ('source_file','source_row','date','tournament','server1','server2','winner','score','pbp_sha256')},'validation':rec,'uniqueness':{'all_historical_meetings':meeting_counts[pairkey(h['winner'],h['loser'])],'forward_candidates':1,'reverse_candidates':1,'independent_exact_date_candidates':1},'trust_level':'LEVEL_1_RESULT_VERIFIED_PBP','verifier_version':VERIFIER_VERSION}
  verified.append(mapping);records.append({'hist':h,'status':'RESULT_VERIFIED_PBP','pbp_ref':mapping['pbp_ref'],'trust_level':mapping['trust_level']})
 total=len(hist);verified_n=counts['RESULT_VERIFIED_PBP'];access=counts['ACCESS_LIMITATION']
 summary={'verifier_version':VERIFIER_VERSION,'tour':tour,'year':year,'historical_matches':total,'pbp_candidates':len(pbps),'verified':verified_n,'partial':counts['REVIEW_REQUIRED'],'ambiguous':counts['AMBIGUOUS_MATCH'],'conflicts':counts['PBP_CONFLICT']+counts['PBP_UNUSABLE'],'no_pbp':counts['NO_PBP_AVAILABLE'],'retrieval_failures':len(pbp_errors),'access_limitations':access,'coverage_pct':round(100*verified_n/total,2) if total else 0.0,'independent_result_source':td_url or None,'independent_result_source_error':td_error,'generated_at_utc':datetime.now(timezone.utc).isoformat()}
 d=ROOT/tour.lower()/str(year);d.mkdir(parents=True,exist_ok=True)
 (d/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');(d/'verified-mappings.json').write_text(json.dumps(verified,indent=2)+'\n');(d/'records.json').write_text(json.dumps(records,indent=2)+'\n')
 update=[f"* {total:,} {tour.replace('_',' ')} historical matches examined.",f"* {len(pbps):,} PBP candidates were actually found.",f"* {verified_n:,} records passed every identity, structural, uniqueness, reverse-verification, and duplicate firewall and were classified VERIFIED.",f"* {counts['REVIEW_REQUIRED']:,} remain REVIEW_REQUIRED; {counts['AMBIGUOUS_MATCH']:,} ambiguous; {summary['conflicts']:,} conflicts/unusable; {summary['no_pbp']:,} no PBP; {access:,} access limitations.",f"* Verified coverage for this batch: {summary['coverage_pct']:.2f}%."]
 (d/'UPDATE.md').write_text('\n'.join(update)+'\n')
 print('BATCH_RESULT '+json.dumps(summary,separators=(',',':')));print('\n'.join(update))

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--tour',required=True,choices=['ATP_MAIN','WTA_MAIN']);ap.add_argument('--year',required=True,type=int);a=ap.parse_args()
 if not 2012<=a.year<=datetime.now(timezone.utc).year:raise SystemExit('YEAR_OUTSIDE_2012_CURRENT')
 run(a.tour,a.year)
