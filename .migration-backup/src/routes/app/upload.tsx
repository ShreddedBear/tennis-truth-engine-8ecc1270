import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { extractPdfText } from "@/lib/pdf-text";
import { ocrPdfLocally } from "@/lib/pdf-ocr";
import { extractMatchupsFromPdf } from "@/lib/pdf-extract.functions";
import { canonicalKey, parseSummaryText, type ParsedMatchup } from "@/lib/summary-parser";
import { REVIEW_FIELDS, compatible, dedupeMatchups, nameTokens, samePair, setResolvedField } from "@/lib/upload-matchup";
import { aiToParsed } from "@/lib/matrix-summary-flatten";
import { runAuditBatch } from "@/lib/audit-pipeline.functions";
import { fetchStageProgress, ingestSummaries } from "@/lib/upload-ingest.functions";
import { resolveMatchContext } from "@/lib/match-context.functions";
import { computeBatchExecutionPercent, type StageProgressRow } from "@/lib/audit-progress";
import { isRecoverablePipelineTransportError } from "@/lib/pipeline-client-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ProgressBar";
// How many matches drive their audit pipeline concurrently. Higher is faster
// wall-clock time for a batch, but every concurrent match multiplies
// simultaneous calls to the research provider — kept modest to avoid trading
// "stuck for 10 minutes" for "rate-limited for 10 minutes." Tune once real
// provider rate limits at 30-90 matches/batch are known.
const AUDIT_CONCURRENCY = 4;
// A PDF built from full-page app screenshots (as opposed to a real text
// export) has no embedded text layer at all, so both the local and server
// text-extraction tiers are guaranteed to find nothing — they only add two
// slow, memory-hungry attempts (opening the whole document via PDF.js twice)
// before falling through to OCR, the one tier that can actually read it. On
// a large multi-page screenshot compilation those two wasted attempts were
// crashing outright (mobile Safari "undefined is not a function", and a bare
// Internal Server Error server-side) before OCR ever got a turn. Skip
// straight to OCR once a file is large enough that it's almost certainly a
// screenshot compilation rather than a compact text export.
const LARGE_PDF_SKIP_TEXT_EXTRACTION_BYTES = 8 * 1024 * 1024;
export const Route = createFileRoute("/app/upload")({ head: () => ({ meta: [{ title: "Upload Summaries — Tennis Matrix Audit System" }] }), component: UploadPage });
interface Staged { filename:string; pages:string[]; matchups:ParsedMatchup[]; source:"TEXT"|"LOCAL_OCR"|"VISION"; }
interface UploadError { id:string; at:string; stage:string; file?:string; match?:string; message:string; }
const ERROR_KEY="tennis-matrix-upload-errors-v1";
function loadErrors():UploadError[]{if(typeof window==="undefined")return[];try{return JSON.parse(window.localStorage.getItem(ERROR_KEY)??"[]").slice(0,100);}catch{return[];}}
function toBase64(file:File):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("Could not read the file"));reader.onload=()=>resolve(String(reader.result).split(",")[1]??"");reader.readAsDataURL(file);});}
function UploadPage(){
 const navigate=useNavigate();const[files,setFiles]=useState<File[]>([]);const[staged,setStaged]=useState<Staged[]>([]);const[busy,setBusy]=useState(false);const[progress,setProgress]=useState<string|null>(null);const[auditProgress,setAuditProgress]=useState<number|null>(null);const[errors,setErrors]=useState<UploadError[]>(loadErrors);
 const visionExtract=useServerFn(extractMatchupsFromPdf);const resolveContext=useServerFn(resolveMatchContext);const executeBatch=useServerFn(runAuditBatch);const ingest=useServerFn(ingestSummaries);const stageProgress=useServerFn(fetchStageProgress);
 const recordError=(stage:string,error:unknown,meta:{file?:string;match?:string}={})=>{const message=error instanceof Error?error.message:String(error??"Unknown error"),entry:UploadError={id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,at:new Date().toISOString(),stage,file:meta.file,match:meta.match,message};setErrors(prev=>{const next=[entry,...prev].slice(0,100);try{window.localStorage.setItem(ERROR_KEY,JSON.stringify(next));}catch{}return next;});console.error(`[${stage}]`,meta,message);return message;};
 const clearErrors=()=>{setErrors([]);try{window.localStorage.removeItem(ERROR_KEY);}catch{}};
 const enrich=async(list:Staged[])=>{const total=list.reduce((a,f)=>a+f.matchups.length,0);let done=0;setProgress(`0 of ${total} completed`);for(const file of list)for(const m of file.matchups){setProgress(`${done} of ${total} completed · Processing ${m.player1_name} vs ${m.player2_name}…`);const hints:Record<string,string|null>={};for(const key of REVIEW_FIELDS)hints[key]=m.fields.find(f=>f.field_key===key)?.normalized_value??null;try{const res=await resolveContext({data:{p1:m.player1_name,p2:m.player2_name,hints}});if(!res.ok){recordError("MATCH CONTEXT RESOLUTION",res.unresolvedReason??"Context resolver returned no usable result",{file:file.filename,match:`${m.player1_name} vs ${m.player2_name}`});}else{for(const key of REVIEW_FIELDS){const value=res.fields[key];if(!value)continue;const old=hints[key];if(!old||String(old)!==String(value))setResolvedField(m,key,String(value));}}}catch(e){recordError("MATCH CONTEXT RESOLUTION",e,{file:file.filename,match:`${m.player1_name} vs ${m.player2_name}`});}finally{done++;setProgress(`${done} of ${total} completed`);}}};
 const analyze=async()=>{if(!files.length)return;setBusy(true);try{const next:Staged[]=[];for(const file of files){setProgress(`Reading ${file.name}…`);let pages:string[]=[];let matchups:ParsedMatchup[]=[];let source:Staged["source"]="TEXT";const isLarge=file.size>LARGE_PDF_SKIP_TEXT_EXTRACTION_BYTES;if(isLarge){toast.info(`${file.name} is ${(file.size/1024/1024).toFixed(1)}MB — likely a screenshot compilation, going straight to on-device OCR. Large batches (30+ matches) are more reliable split into a few smaller uploads.`);}else{try{pages=(await extractPdfText(file)).pages;matchups=parseSummaryText(pages);}catch(e){pages=[];recordError("PDF TEXT EXTRACTION",e,{file:file.name});}}if(matchups.length===0){setProgress(`${file.name}: running free local OCR…`);try{const ocr=await ocrPdfLocally(file,m=>setProgress(`${file.name}: ${m}`));pages=ocr.pages;matchups=parseSummaryText(pages);source="LOCAL_OCR";}catch(e){recordError("LOCAL OCR",e,{file:file.name});}}if(matchups.length===0&&!isLarge){setProgress(`${file.name}: local OCR found no matchup — trying vision extraction…`);try{const base64=await toBase64(file);const{matchups:ai}=await visionExtract({data:{filename:file.name,base64}});matchups=ai.map(aiToParsed);source="VISION";}catch(e){const message=recordError("VISION EXTRACTION",e,{file:file.name});if(/402|credit/i.test(message))toast.error(`${file.name}: local OCR could not identify the matchup and AI credits are exhausted.`);else toast.error(`${file.name}: ${message}`);}}matchups=dedupeMatchups(matchups);if(!matchups.length){recordError("MATCHUP DETECTION","No matchups detected — review required",{file:file.name});toast.warning(`${file.name}: no matchups detected — review required`);}next.push({filename:file.name,pages,matchups,source});}await enrich(next);for(const f of next)f.matchups=dedupeMatchups(f.matchups);setStaged(s=>[...s,...next]);setFiles([]);}catch(e){const message=recordError("START ANALYSIS",e);toast.error(`Analysis failed: ${message}`);}finally{setProgress(null);setBusy(false);}};
 const editField=(fi:number,mi:number,key:string,value:string)=>setStaged(s=>s.map((f,i)=>i!==fi?f:{...f,matchups:f.matchups.map((m,j)=>{if(j!==mi)return m;const exists=m.fields.some(x=>x.field_key===key);const fields=exists?m.fields.map(x=>x.field_key===key?{...x,normalized_value:value,extraction_status:"DIRECT" as const}:x):[...m.fields,{field_key:key,raw_value:null,normalized_value:value,extraction_status:"PARTIAL" as const,confidence:1,page_number:m.page_number}];return{...m,fields};})}));
 // Player names come straight out of OCR (never labeled "player:" like the
 // other reviewable fields), so an icon-glyph misread ("She Emile Hudd") can
 // survive the automated cleanup. Names aren't in REVIEW_FIELDS/parsed_summary
 //_fields — they're columns on the match itself — so they get their own editor
 // here rather than the generic editField path, letting the user fix exactly
 // this class of residual OCR noise by eye before anything is ingested.
 const editPlayerName=(fi:number,mi:number,side:"player1_name"|"player2_name",value:string)=>setStaged(s=>s.map((f,i)=>i!==fi?f:{...f,matchups:f.matchups.map((m,j)=>j!==mi?m:{...m,[side]:value})}));
 const fieldValue=(m:ParsedMatchup,key:string)=>m.fields.find(f=>f.field_key===key)?.normalized_value??"";
 const commit=async()=>{setBusy(true);
  try{
    // The whole ingestion transaction -- summary_uploads, matches, summary_versions,
    // parsed_summary_fields -- runs on the server now. This screen sends what the reviewer
    // approved and receives what was written; it never names a table or a row.
    const{created,reused,versions,matchIds,failures}=await ingest({data:{files:staged}});
    for(const failure of failures)recordError(failure.stage,failure.message,{file:failure.file,match:failure.match});
  setAuditProgress(0);
  if(!matchIds.length)throw new Error("No matches were ingested successfully, so no audit batch was started.");
  try{
    const batch=await executeBatch({data:{matchIds,concurrency:AUDIT_CONCURRENCY}});
    const runIds=batch.results.map(result=>result.runId).filter((id):id is string=>Boolean(id));
    if(runIds.length){const rows=await stageProgress({data:{runIds}});const byRun=new Map<string,StageProgressRow[]>();for(const row of rows){const list=byRun.get(row.audit_run_id)??[];list.push(row);byRun.set(row.audit_run_id,list);}setAuditProgress(computeBatchExecutionPercent(byRun));}
    for(const result of batch.results)if(!result.ok&&result.failures?.[0])recordError("AUDIT PIPELINE",result.failures[0].message,{match:result.matchId});
    toast.success(`${created} new matches, ${reused} existing matches reused, ${versions} summary versions, ${matchIds.length} audit runs queued`);
  }catch(error){
    if(isRecoverablePipelineTransportError(error))toast.info("The start response was interrupted, but ingested matches are persisted. Active Slate will claim and continue every unfinished audit automatically.");
    else recordError("AUDIT BATCH START",error);
  }
  navigate({to:"/app/slate"});}catch(e){const message=recordError("INGEST & RUN AUDITS",e);toast.error(`Ingestion failed: ${message}`);}finally{setBusy(false);setStaged([]);setAuditProgress(null);}};
 return <div className="space-y-4"><div><h1 className="text-xl font-semibold">Upload summaries & parse review</h1><p className="text-sm text-muted-foreground">Every page of every PDF is read. Full-name and shortened-name variants of the same matchup are consolidated before ingestion.</p></div><div className="panel space-y-3 p-4"><Input type="file" accept="application/pdf" multiple disabled={busy} onChange={e=>setFiles(Array.from(e.target.files??[]))}/><Button className="w-full sm:w-auto" onClick={analyze} disabled={busy||files.length===0}>{busy?"Analyzing…":`Start analysis${files.length?` (${files.length} PDF${files.length>1?"s":""})`:""}`}</Button>{progress&&<p className="mono-num text-xs text-muted-foreground">{progress}</p>}<p className="text-xs text-muted-foreground">Image-only PDFs use free on-device OCR first. Missing or corrupted context is reconstructed from independent public/local data when possible; unreadable facts are not guessed.</p></div>{errors.length>0&&<section className="panel border-destructive/40 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Errors / run log</h2><p className="text-xs text-muted-foreground">These errors are saved on this device and will not disappear with the toast.</p></div><Button type="button" variant="outline" size="sm" onClick={clearErrors}>Clear</Button></div><div className="mt-3 max-h-80 space-y-2 overflow-auto">{errors.map(e=><div key={e.id} className="rounded-md border border-destructive/30 p-3 text-xs"><div className="flex flex-wrap gap-x-3 gap-y-1"><strong>{e.stage}</strong><span className="mono-num text-muted-foreground">{new Date(e.at).toLocaleString()}</span>{e.file&&<span>File: {e.file}</span>}{e.match&&<span>Match: {e.match}</span>}</div><p className="mt-1 break-words font-mono text-[11px]">{e.message}</p></div>)}</div></section>}{staged.map((file,fi)=><section key={file.filename+fi} className="panel p-4"><h2 className="font-semibold">{file.filename} <span className="mono-num text-xs font-normal text-muted-foreground">{file.pages.length} pages · {file.matchups.length} unique matchups · {file.source}</span></h2><div className="mt-3 space-y-3">{file.matchups.map((m,mi)=><div key={mi} className="rounded-md border border-border p-3"><div className="flex flex-wrap items-center gap-2"><Input className="h-8 w-44 font-medium" value={m.player1_name} onChange={e=>editPlayerName(fi,mi,"player1_name",e.target.value)}/><span className="text-muted-foreground">vs</span><Input className="h-8 w-44 font-medium" value={m.player2_name} onChange={e=>editPlayerName(fi,mi,"player2_name",e.target.value)}/><span className="mono-num text-xs text-muted-foreground">page {m.page_number} · parser confidence {(m.confidence*100).toFixed(0)}%</span></div><p className="mt-1 text-[11px] text-muted-foreground">Names come straight from OCR — check them against the source PDF and correct here before ingesting; nothing downstream re-derives them.</p><div className="mt-2 grid gap-2 md:grid-cols-3">{REVIEW_FIELDS.map(key=><label key={key} className="text-xs"><span className="text-muted-foreground">{key}</span><Input className="mt-1 h-8" value={fieldValue(m,key)} placeholder="UNAVAILABLE" onChange={e=>editField(fi,mi,key,e.target.value)}/></label>)}</div><p className="mono-num mt-2 text-[11px] text-muted-foreground">{m.fields.length} fields extracted/reconstructed</p></div>)}</div></section>)}{staged.length>0&&<div className="space-y-2"><Button onClick={commit} disabled={busy||staged.every(f=>f.matchups.length===0)}>{busy?"Ingesting & running audits…":"Ingest & run audits"}</Button>{auditProgress!==null&&<div><ProgressBar percent={auditProgress} widthClassName="w-40"/><p className="mt-1 text-xs text-muted-foreground">Running audits — this bar tracks pipeline-stage progress across every uploaded match; it will keep moving even on a slow connection.</p></div>}</div>}</div>;
}
