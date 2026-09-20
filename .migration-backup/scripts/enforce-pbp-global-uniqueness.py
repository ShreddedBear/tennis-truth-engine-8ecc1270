#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,io,json,re,unicodedata,urllib.request
from collections import defaultdict,Counter
from datetime import datetime,timezone
from pathlib import Path

BASE='https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main'
OUT=Path('data/audit/verified-pbp')
UA='tennis-truth-engine-global-pbp-uniqueness/1.0'
FINAL_VERSION=3

def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':UA})
 with urllib.request.urlopen(req,timeout=90) as r:return r.read().decode('utf-8-sig','replace')
def nn(s):return re.sub(r'[^a-z0-9]+','',unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower())
def nt(s):
 s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower();s=re.sub(r'\b(atp|wta)\b','',s);s=re.sub(r'20\d{2}','',s);return re.sub(r'[^a-z0-9]+','',s)
def tny(a,b):
 x,y=nt(a),nt(b);return bool(x and y and (x in y or y in x))
def score(s):return re.sub(r'\s+',' ',str(s or '').upper().replace('RET','').replace('DEF','').replace('W/O','').strip())
def pair(a,b):return tuple(sorted((nn(a),nn(b))))
def rn(s):
 x=re.sub(r'[^a-z0-9]+','',str(s or '').lower())
 return {'final':'f','thefinal':'f','semifinal':'sf','semifinals':'sf','quarterfinal':'qf','quarterfinals':'qf','4thround':'r16','fourthround':'r16','3rdround':'r32','thirdround':'r32','2ndround':'r64','secondround':'r64','1stround':'r128','firstround':'r128'}.get(x,x)

def build_index(tour,target_pairs):
 folder='atp' if tour=='ATP_MAIN' else 'wta';pre='atp' if tour=='ATP_MAIN' else 'wta'
 idx=defaultdict(list);errors=[];current=datetime.now(timezone.utc).year
 for y in range(1968,current+1):
  url=f'{BASE}/{folder}/{pre}_matches_{y}.csv'
  try:rows=csv.DictReader(io.StringIO(get(url)))
  except Exception as e:
   errors.append({'year':y,'error':type(e).__name__});continue
  for r in rows:
   pk=pair(r.get('winner_name'),r.get('loser_name'))
   if pk not in target_pairs:continue
   idx[pk].append({'year':y,'tournament':r.get('tourney_name',''),'level':(r.get('tourney_level') or '').upper(),'round':r.get('round',''),'winner':r.get('winner_name',''),'loser':r.get('loser_name',''),'winner_id':r.get('winner_id',''),'loser_id':r.get('loser_id',''),'score':score(r.get('score','')),'tourney_id':r.get('tourney_id',''),'match_num':r.get('match_num','')})
 return idx,errors

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--tour',choices=['ATP_MAIN','WTA_MAIN'],required=True);ap.add_argument('--year',type=int,required=True);a=ap.parse_args()
 d=OUT/a.tour.lower()/str(a.year);vp=d/'verified-mappings.json';sp=d/'summary.json';rp=d/'records.json'
 verified=json.loads(vp.read_text());summary=json.loads(sp.read_text());records=json.loads(rp.read_text())
 targets={pair(m['historical']['winner'],m['historical']['loser']) for m in verified}
 idx,errors=build_index(a.tour,targets)
 kept=[];downgraded={};
 for m in verified:
  h=m['historical'];pk=pair(h['winner'],h['loser']);meet=idx.get(pk,[])
  plausible=[]
  for z in meet:
   if z['year']!=a.year:continue
   if nn(z['winner'])!=nn(h['winner']):continue
   if score(z['score'])!=score(h['score']):continue
   if rn(z['round'])!=rn(h['round']):continue
   if not tny(z['tournament'],h['tournament']):continue
   if str(h.get('winner_id') or '') and str(z.get('winner_id') or '') and str(h['winner_id'])!=str(z['winner_id']):continue
   if str(h.get('loser_id') or '') and str(z.get('loser_id') or '') and str(h['loser_id'])!=str(z['loser_id']):continue
   plausible.append(z)
  key=str(h['hist_index'])
  if errors:
   downgraded[key]=('ACCESS_LIMITATION',len(meet),len(plausible));continue
  if len(plausible)==1:
   m['uniqueness']['all_historical_meetings']=len(meet);m['uniqueness']['all_time_plausible_matches']=1;m['uniqueness']['all_time_search_years']='1968-current';m['verifier_version']=FINAL_VERSION;kept.append(m)
  elif len(plausible)==0:downgraded[key]=('NO_MATCH',len(meet),0)
  else:downgraded[key]=('AMBIGUOUS_MATCH',len(meet),len(plausible))

 for r in records:
  h=r.get('hist') or {};key=str(h.get('hist_index'))
  if r.get('status')=='RESULT_VERIFIED_PBP' and key in downgraded:
   st,mc,pc=downgraded[key];r['status']=st;r['global_uniqueness']={'all_historical_meetings':mc,'plausible_matches':pc,'search_years':'1968-current'};r.pop('trust_level',None)
  elif r.get('status')=='RESULT_VERIFIED_PBP':r['verifier_version']=FINAL_VERSION

 c=Counter(r.get('status') for r in records)
 summary.update({'verifier_version':FINAL_VERSION,'verified':len(kept),'partial':c['REVIEW_REQUIRED']+c['ACCESS_LIMITATION'],'ambiguous':c['AMBIGUOUS_MATCH'],'conflicts':c['PBP_CONFLICT']+c['PBP_UNUSABLE'],'no_pbp':c['NO_PBP_AVAILABLE'],'retrieval_failures':c['RETRIEVAL_FAILED'],'coverage_pct':round(100*len(kept)/summary['historical_matches'],2) if summary['historical_matches'] else 0.0,'all_time_meeting_search':'1968-current','all_time_index_errors':errors,'generated_at_utc':datetime.now(timezone.utc).isoformat()})
 vp.write_text(json.dumps(kept,indent=2)+'\n');rp.write_text(json.dumps(records,indent=2)+'\n');sp.write_text(json.dumps(summary,indent=2)+'\n')
 print('GLOBAL_UNIQUENESS_RESULT '+json.dumps({'tour':a.tour,'year':a.year,'kept_verified':len(kept),'downgraded':len(downgraded),'index_errors':len(errors)},separators=(',',':')))
if __name__=='__main__':main()
