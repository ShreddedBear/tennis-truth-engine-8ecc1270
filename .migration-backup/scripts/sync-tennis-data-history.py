#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, re, sys, zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import pandas as pd
import requests
from bs4 import BeautifulSoup, Tag

BASE="https://www.tennis-data.co.uk/"; INDEX=urljoin(BASE,"alldata.php"); START_YEAR=2005; OUT=Path("data/public/tennis-data"); UA="TennisTruthEngine historical sync/1.1"
SESSION=requests.Session(); SESSION.headers.update({"User-Agent":UA})
def text(x):
    if x is None:return ""
    try:
        if pd.isna(x):return ""
    except Exception:pass
    return str(x).strip()
def norm_col(v):return re.sub(r"[^a-z0-9]+","",v.lower())
def first(row,*names):
    lookup={norm_col(str(k)):v for k,v in row.items()}
    for name in names:
        s=text(lookup.get(norm_col(name)))
        if s:return s
    return ""
def parse_date(v):
    v=text(v)
    if not v:return ""
    for fmt in ("%d/%m/%Y","%Y-%m-%d","%d-%m-%Y","%m/%d/%Y","%Y/%m/%d"):
        try:return datetime.strptime(v,fmt).date().isoformat()
        except ValueError:pass
    d=pd.to_datetime(v,dayfirst=True,errors="coerce")
    return "" if pd.isna(d) else d.date().isoformat()
def infer_tour(anchor:Tag):
    node=anchor
    for _ in range(500):
        if node is None:break
        node=node.previous_element
        if not isinstance(node,str):continue
        s=" ".join(node.split()).lower()
        if "wta women's tour" in s or "wta womens tour" in s or "women's tour" in s:return "WTA"
        if "atp men's tour" in s or "atp mens tour" in s or "men's tour" in s:return "ATP"
    return None
def exists_url(url):
    try:
        r=SESSION.get(url,timeout=25,stream=True,allow_redirects=True)
        ok=r.status_code==200
        r.close()
        return ok
    except Exception:return False
def direct_candidates(tour,year):
    suffix="w" if tour=="WTA" else ""
    stem=f"{year}{suffix}"
    return [
        urljoin(BASE,f"{year}/{stem}.xlsx"),
        urljoin(BASE,f"{year}/{stem}.xls"),
        urljoin(BASE,f"{year}/{stem}.csv"),
        urljoin(BASE,f"{year}/{stem}.zip"),
    ]
def discover():
    found={};current=datetime.now(timezone.utc).year
    try:
        r=SESSION.get(INDEX,timeout=45);r.raise_for_status();soup=BeautifulSoup(r.text,"html.parser")
        for a in soup.find_all("a",href=True):
            href=str(a.get("href") or ""); low=href.lower();
            if not any(ext in low for ext in (".zip",".xls",".xlsx",".csv")):continue
            label=" ".join(a.stripped_strings); parent=" ".join(a.parent.stripped_strings) if a.parent else "";m=re.search(r"\b(20\d{2})\b",f"{label} {parent} {href}")
            if not m:continue
            year=int(m.group(1));
            if year<START_YEAR or year>current:continue
            tour=infer_tour(a)
            if not tour:
                # Tennis-Data commonly marks WTA annual files with a trailing 'w'.
                base=low.rsplit('/',1)[-1]
                tour="WTA" if re.search(rf"{year}w(?:\.|$)",base) else "ATP"
            found.setdefault((tour,year),urljoin(BASE,href))
    except Exception as exc:
        print(f"Index discovery warning: {exc}",file=sys.stderr)
    # Robust fallback: probe the site's long-standing annual naming convention.
    for tour in ("ATP","WTA"):
        for year in range(START_YEAR,current+1):
            if (tour,year) in found:continue
            for url in direct_candidates(tour,year):
                if exists_url(url):
                    found[(tour,year)]=url;break
    return found
def read_download(url):
    r=SESSION.get(url,timeout=90);r.raise_for_status();data=r.content;low=url.lower()
    if low.endswith(".csv"):return pd.read_csv(io.BytesIO(data),encoding_errors="ignore")
    if low.endswith(".zip") or data[:2]==b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names=[n for n in z.namelist() if n.lower().endswith((".xls",".xlsx",".csv")) and not n.startswith("__MACOSX/")]
            if not names:raise RuntimeError(f"No spreadsheet in {url}")
            name=names[0];payload=z.read(name)
            return pd.read_csv(io.BytesIO(payload),encoding_errors="ignore") if name.lower().endswith(".csv") else pd.read_excel(io.BytesIO(payload))
    return pd.read_excel(io.BytesIO(data))
def normalize(df,tour,url):
    out=[]
    for raw in df.to_dict(orient="records"):
        date=parse_date(first(raw,"Date"));winner=first(raw,"Winner");loser=first(raw,"Loser")
        if not date or int(date[:4])<START_YEAR or not winner or not loser:continue
        sets=[]
        for i in range(1,6):
            w,l=first(raw,f"W{i}"),first(raw,f"L{i}")
            if w and l:sets.append(f"{w}-{l}")
        out.append({"source":"tennis-data","source_url":url,"tour":tour,"date":date,"tournament":first(raw,"Tournament"),"location":first(raw,"Location"),"event_level":first(raw,"Series","Tier"),"court":first(raw,"Court"),"surface":first(raw,"Surface"),"round":first(raw,"Round"),"best_of":first(raw,"Best of","BestOf"),"winner":winner,"loser":loser,"winner_rank":first(raw,"WRank"),"loser_rank":first(raw,"LRank"),"score":" ".join(sets),"comment":first(raw,"Comment")})
    return out
FIELDS=["source","source_url","tour","date","tournament","location","event_level","court","surface","round","best_of","winner","loser","winner_rank","loser_rank","score","comment"]
def main():
    links=discover();current=datetime.now(timezone.utc).year
    print(f"Discovered {len(links)} annual files.")
    for tour in ("ATP","WTA"):
        years=sorted(y for (t,y) in links if t==tour);print(f"{tour} years: {years[0] if years else 'NONE'}..{years[-1] if years else 'NONE'} ({len(years)})")
    if not links:print("No Tennis-Data downloads discovered",file=sys.stderr);return 2
    required=[(t,y) for t in ("ATP","WTA") for y in range(START_YEAR,current)];missing=[x for x in required if x not in links]
    if missing:
        print(f"Missing completed-season links ({len(missing)}): {missing}",file=sys.stderr);return 3
    manifest=[];OUT.mkdir(parents=True,exist_ok=True)
    for (tour,year),url in sorted(links.items()):
        try:
            rows=normalize(read_download(url),tour,url);path=OUT/tour.lower()/f"{year}.csv";path.parent.mkdir(parents=True,exist_ok=True)
            with path.open("w",newline="",encoding="utf-8") as f:w=csv.DictWriter(f,fieldnames=FIELDS);w.writeheader();w.writerows(rows)
            manifest.append({"tour":tour,"year":year,"rows":len(rows),"url":url,"path":str(path)})
            print(f"{tour} {year}: {len(rows)} rows <- {url}")
        except Exception as exc:
            if year<current:raise
            print(f"Optional current-season fetch failed for {tour} {year}: {exc}",file=sys.stderr)
    (OUT/"MANIFEST.json").write_text(json.dumps({"source":"Tennis-Data","source_page":INDEX,"historical_start":f"{START_YEAR}-01-01","generated_at_utc":datetime.now(timezone.utc).isoformat(),"files":manifest},indent=2)+"\n",encoding="utf-8")
    return 0
if __name__=="__main__":raise SystemExit(main())
