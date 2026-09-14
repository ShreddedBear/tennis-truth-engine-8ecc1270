#!/usr/bin/env python3
from __future__ import annotations
import csv, hashlib, io, json, re, sys, unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import requests

START_YEAR=2005
END_YEAR=datetime.now(timezone.utc).year
API="https://stats.tennismylife.org/api/data-files"
OUT=Path("data/public/tennismylife-challenger")
RAW=OUT/"raw"
NORMALIZED=OUT/"normalized"
REPORTS=OUT/"reports"

STATUS_DOWNLOADED="DOWNLOADED"
STATUS_NOT_AVAILABLE="NOT_AVAILABLE"
STATUS_RETRIEVAL_FAILED="RETRIEVAL_FAILED"

def clean(v:Any)->str:
    return "" if v is None else str(v).strip()

def norm_text(v:Any)->str:
    s=unicodedata.normalize("NFKD",clean(v))
    s="".join(ch for ch in s if not unicodedata.combining(ch))
    s=re.sub(r"[^A-Za-z0-9]+"," ",s).lower().strip()
    return re.sub(r"\s+"," ",s)

def csv_rows(text:str):
    return list(csv.DictReader(io.StringIO(text)))

def file_sha(data:bytes)->str:
    return hashlib.sha256(data).hexdigest()

def match_key(row:dict[str,str], year:int)->str:
    ids=sorted([clean(row.get("winner_id")),clean(row.get("loser_id"))])
    if not all(ids): ids=sorted([norm_text(row.get("winner_name")),norm_text(row.get("loser_name"))])
    material="|".join(["ATP_CHALLENGER",clean(row.get("tourney_id")),clean(row.get("tourney_date")) or str(year),norm_text(row.get("round")),ids[0] if ids else "",ids[1] if len(ids)>1 else "",clean(row.get("match_num"))])
    return hashlib.sha256(material.encode()).hexdigest()[:32]

def validate_stats(row:dict[str,str])->list[str]:
    errs=[]
    def n(k):
        v=clean(row.get(k))
        if v=="": return None
        try: return float(v)
        except: errs.append(f"NON_NUMERIC:{k}"); return None
    for p in ("w","l"):
        vals={k:n(f"{p}_{k}") for k in ["ace","df","svpt","1stIn","1stWon","2ndWon","SvGms","bpSaved","bpFaced"]}
        for k,v in vals.items():
            if v is not None and v<0: errs.append(f"NEGATIVE:{p}_{k}")
        if vals["1stIn"] is not None and vals["svpt"] is not None and vals["1stIn"]>vals["svpt"]: errs.append(f"IMPOSSIBLE:{p}_1stIn>{p}_svpt")
        if vals["1stWon"] is not None and vals["1stIn"] is not None and vals["1stWon"]>vals["1stIn"]: errs.append(f"IMPOSSIBLE:{p}_1stWon>{p}_1stIn")
        if vals["bpSaved"] is not None and vals["bpFaced"] is not None and vals["bpSaved"]>vals["bpFaced"]: errs.append(f"IMPOSSIBLE:{p}_bpSaved>{p}_bpFaced")
    return errs

def find_file(files:list[dict], year:int):
    expected=f"{year}_challenger.csv".lower()
    exact=[f for f in files if clean(f.get("name")).lower()==expected]
    if exact: return exact[0]
    candidates=[f for f in files if str(year) in clean(f.get("name")).lower() and "challenger" in clean(f.get("name")).lower() and clean(f.get("name")).lower().endswith(".csv")]
    return candidates[0] if len(candidates)==1 else None

def year_from_row(row,fallback):
    d=clean(row.get("tourney_date"))
    if len(d)>=4 and d[:4].isdigit(): return int(d[:4])
    tid=clean(row.get("tourney_id"))
    if len(tid)>=4 and tid[:4].isdigit(): return int(tid[:4])
    return fallback

def write_csv(path:Path,rows:list[dict],fields:list[str]):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction="ignore"); w.writeheader(); w.writerows(rows)

def main():
    OUT.mkdir(parents=True,exist_ok=True); RAW.mkdir(exist_ok=True); NORMALIZED.mkdir(exist_ok=True); REPORTS.mkdir(exist_ok=True)
    retrieved=datetime.now(timezone.utc).isoformat()
    try:
        r=requests.get(API,timeout=60); r.raise_for_status(); files=r.json().get("files",[])
    except Exception as e:
        print(f"API retrieval failed: {e}",file=sys.stderr); return 2
    manifest=[]; global_keys={}
    for year in range(START_YEAR,END_YEAR+1):
        entry={"year":year,"status":None,"source_file":None,"source_url":None,"retrieval_timestamp":retrieved}
        fmeta=find_file(files,year)
        if not fmeta:
            entry["status"]=STATUS_NOT_AVAILABLE; manifest.append(entry); print(json.dumps(entry)); continue
        url=clean(fmeta.get("url")); name=clean(fmeta.get("name")); entry.update(source_file=name,source_url=url)
        try:
            rr=requests.get(url,timeout=120); rr.raise_for_status(); data=rr.content
        except Exception as e:
            entry.update(status=STATUS_RETRIEVAL_FAILED,error=str(e)); manifest.append(entry); print(json.dumps(entry)); continue
        (RAW/name).write_bytes(data)
        rows=csv_rows(data.decode("utf-8-sig",errors="replace"))
        entry.update(status=STATUS_DOWNLOADED,file_sha256=file_sha(data),rows_downloaded=len(rows))
        normalized=[]; exact_dup=probable_dup=conflicting=year_conflicts=stat_conflicts=0; local={}
        for idx,row in enumerate(rows,start=2):
            assigned=year_from_row(row,year); yc=assigned!=year; year_conflicts += int(yc)
            key=match_key(row,year); stat_errs=validate_stats(row); stat_conflicts += int(bool(stat_errs)); status="NEW_MATCH"
            if key in local:
                prev=local[key]; same=(norm_text(prev.get("winner_name"))==norm_text(row.get("winner_name")) and norm_text(prev.get("score"))==norm_text(row.get("score")))
                status="EXACT_DUPLICATE" if same else "CONFLICTING_DUPLICATE"; exact_dup += int(same); conflicting += int(not same)
            elif key in global_keys:
                status="PROBABLE_DUPLICATE"; probable_dup+=1
            else:
                local[key]=row; global_keys[key]=year
            out=dict(row); out.update({"_source":"TennisMyLife","_source_file":name,"_source_year":str(year),"_retrieved_at":retrieved,"_original_row_number":str(idx),"_match_key":key,"_dedup_status":status,"_year_conflict":"1" if yc else "0","_stat_integrity_conflicts":";".join(stat_errs),"_winner_name_normalized":norm_text(row.get("winner_name")),"_loser_name_normalized":norm_text(row.get("loser_name")),"_tourney_name_normalized":norm_text(row.get("tourney_name")),"_round_normalized":norm_text(row.get("round")),"_surface_normalized":norm_text(row.get("surface"))})
            normalized.append(out)
        fields=list(rows[0].keys()) if rows else []
        extra=["_source","_source_file","_source_year","_retrieved_at","_original_row_number","_match_key","_dedup_status","_year_conflict","_stat_integrity_conflicts","_winner_name_normalized","_loser_name_normalized","_tourney_name_normalized","_round_normalized","_surface_normalized"]
        write_csv(NORMALIZED/f"{year}_challenger_normalized.csv",normalized,fields+extra)
        entry.update(rows_parsed=len(rows),unique_matches=len(local),exact_duplicates=exact_dup,probable_duplicates=probable_dup,conflicting_duplicates=conflicting,year_conflicts=year_conflicts,stat_integrity_conflicts=stat_conflicts)
        (REPORTS/f"{year}.json").write_text(json.dumps(entry,indent=2)+"\n")
        manifest.append(entry); print(json.dumps(entry))
    (OUT/"IMPORT_MANIFEST.json").write_text(json.dumps({"source":"TennisMyLife Tennis Match Database","range":f"{START_YEAR}-{END_YEAR}","generated_at":retrieved,"years":manifest},indent=2)+"\n")
    return 0
if __name__=="__main__": raise SystemExit(main())
