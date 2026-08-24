#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, os, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE='https://sports.bzzoiro.com/tennis/api/v2'
TOKEN=os.environ['BSD_TENNIS_API_KEY']
HEAD={'Authorization':f'Token {TOKEN}','User-Agent':'tennis-truth-engine-wta-challenger-pbp/1.0'}
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'audit'/'bsd-wta-challenger-pbp'
RAW=OUT/'matches.jsonl'
STATE=OUT/'state.json'
SUMMARY=OUT/'summary.md'
START_YEAR=2025
CURRENT_YEAR=datetime.now(timezone.utc).year
MAX_PAGES=100


def get(path,params=None):
    url=BASE+path
    if params: url+='?'+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers=HEAD)
    try:
        with urllib.request.urlopen(req,timeout=30) as r:
            return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:b=json.loads(e.read().decode())
        except:b={}
        return e.code,b
    except Exception as e:
        return 0,{'error':type(e).__name__,'message':str(e)}


def is_wta_challenger(m):
    t=m.get('tournament') or {}; p1=m.get('player1') or {}; p2=m.get('player2') or {}
    circuit=str(t.get('circuit') or m.get('circuit') or '').upper()
    cat=str(t.get('category') or m.get('category') or m.get('tournament_level') or '').lower()
    name=str(t.get('name') or '').lower()
    gender=str(p1.get('gender') or p2.get('gender') or '').upper()
    female=(circuit=='WTA' or gender=='F')
    challenger=('challenger' in cat or 'challenger' in name or '125' in cat or '125' in name)
    return female and challenger


def pbp_meaningful(x):
    if not x:return False
    blob=json.dumps(x,sort_keys=True).lower()
    return ('points' in blob or 'point_sequence' in blob or 'score_sequence' in blob) and ('server' in blob or '15' in blob or '40' in blob)


def load_existing():
    by_id={}; by_hash={}
    if RAW.exists():
        for line in RAW.read_text().splitlines():
            if not line.strip(): continue
            try:r=json.loads(line)
            except:continue
            by_id[str(r.get('match_id'))]=r
            if r.get('pbp_sha256'): by_hash[r['pbp_sha256']]=r
    return by_id,by_hash


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    by_id,by_hash=load_existing()
    counters={'examined':0,'wta_challenger_matches':0,'pbp_found':0,'pbp_missing':0,'duplicates_skipped':0,'hash_collisions':0,'http_failures':0,'new_records':0}
    years={}
    append=[]

    for year in range(CURRENT_YEAR,START_YEAR-1,-1):
        yc={'examined':0,'wta_challenger_matches':0,'pbp_found':0,'pbp_missing':0,'new_records':0}
        for page in range(MAX_PAGES):
            st,data=get('/matches/',{'status':'finished','date_from':f'{year}-01-01','date_to':f'{year}-12-31','limit':200,'offset':page*200})
            if st!=200:
                counters['http_failures']+=1
                break
            matches=data.get('results',[]) if isinstance(data,dict) else []
            if not matches: break
            for m in matches:
                counters['examined']+=1; yc['examined']+=1
                if not is_wta_challenger(m): continue
                counters['wta_challenger_matches']+=1; yc['wta_challenger_matches']+=1
                mid=m.get('id')
                if mid is None: continue
                if str(mid) in by_id:
                    counters['duplicates_skipped']+=1
                    continue
                ps,payload=get(f'/matches/{mid}/point-by-point/')
                if ps!=200:
                    counters['http_failures']+=1; yc['pbp_missing']+=1; counters['pbp_missing']+=1
                    continue
                if not pbp_meaningful(payload):
                    yc['pbp_missing']+=1; counters['pbp_missing']+=1
                    continue
                blob=json.dumps(payload,sort_keys=True,separators=(',',':'))
                sha=hashlib.sha256(blob.encode()).hexdigest()
                if sha in by_hash:
                    counters['hash_collisions']+=1
                    continue
                rec={'tour':'WTA_CHALLENGER','year':year,'match_id':mid,'date':m.get('match_date'),'tournament':(m.get('tournament') or {}).get('name'),'player1':(m.get('player1') or {}).get('name'),'player2':(m.get('player2') or {}).get('name'),'pbp_sha256':sha,'pbp':payload,'source':'BSD','retrieved_at_utc':datetime.now(timezone.utc).isoformat()}
                append.append(rec); by_id[str(mid)]=rec; by_hash[sha]=rec
                counters['pbp_found']+=1; counters['new_records']+=1; yc['pbp_found']+=1; yc['new_records']+=1
                time.sleep(.08)
        years[str(year)]=yc
        print('YEAR_UPDATE '+json.dumps({'year':year,**yc},separators=(',',':')),flush=True)

    if append:
        with RAW.open('a') as f:
            for r in append:f.write(json.dumps(r,separators=(',',':'))+'\n')

    state={'scope':'WTA Challenger/WTA 125 only','source':'BSD','start_year':START_YEAR,'through_year':CURRENT_YEAR,'updated_at_utc':datetime.now(timezone.utc).isoformat(),'totals':counters,'years':years,'unique_match_ids':len(by_id),'unique_pbp_hashes':len(by_hash),'firewall':{'match_id_unique':True,'pbp_hash_unique':True,'other_tours_excluded':True}}
    STATE.write_text(json.dumps(state,indent=2)+'\n')
    lines=['# BSD WTA Challenger PBP','',f"- Scope: **WTA Challenger/WTA 125 only**",f"- Years: **{START_YEAR}–{CURRENT_YEAR}**",f"- Unique stored match IDs: **{len(by_id)}**",f"- Unique stored PBP hashes: **{len(by_hash)}**",f"- New records this run: **{counters['new_records']}**",f"- Missing/no usable PBP this run: **{counters['pbp_missing']}**",f"- Duplicate match IDs skipped: **{counters['duplicates_skipped']}**",f"- Duplicate PBP hashes blocked: **{counters['hash_collisions']}**",'', '| Year | WTA Challenger matches | PBP found | PBP missing | New stored |','|---:|---:|---:|---:|---:|']
    for y in sorted(years,reverse=True):
        x=years[y]; lines.append(f"| {y} | {x['wta_challenger_matches']} | {x['pbp_found']} | {x['pbp_missing']} | {x['new_records']} |")
    SUMMARY.write_text('\n'.join(lines)+'\n')
    print('FINAL_UPDATE '+json.dumps(counters,separators=(',',':')),flush=True)

if __name__=='__main__': main()
