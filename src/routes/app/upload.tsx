import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extractPdfText } from "@/lib/pdf-text";
import { ocrPdfLocally } from "@/lib/pdf-ocr";
import { extractMatchupsFromPdf, type AiMatchup } from "@/lib/pdf-extract.functions";
import { canonicalKey, parseSummaryText, type ParsedMatchup } from "@/lib/summary-parser";
import { log } from "@/lib/audit-runs";
import { runAuditPipeline } from "@/lib/audit-pipeline.functions";
import { resolveMatchContext } from "@/lib/match-context.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/upload")({
  head: () => ({ meta: [{ title: "Upload Summaries — Tennis Matrix Audit System" }] }),
  component: UploadPage,
});

interface Staged {
  filename: string;
  pages: string[];
  matchups: ParsedMatchup[];
  source: "TEXT" | "LOCAL_OCR" | "VISION";
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function aiToParsed(m: AiMatchup): ParsedMatchup {
  const page = m.page_number || 1;
  const entries: Array<[string, string | null]> = [
    ["tournament", m.tournament], ["event_level", m.event_level], ["round", m.round],
    ["scheduled_date", m.scheduled_date], ["surface", m.surface], ["best_of", m.best_of],
    ["matrix_predicted_winner", m.matrix_predicted_winner], ["matrix_wp", m.matrix_wp],
    ...Object.entries(m.other_fields ?? {}),
  ];
  return { player1_name:m.player1_name, player2_name:m.player2_name, page_number:page, confidence:0.85,
    fields:entries.filter(([,v])=>v!==null&&v!==undefined&&String(v).trim()!=="").map(([key,v])=>({field_key:key,raw_value:String(v),normalized_value:String(v),extraction_status:"DIRECT" as const,confidence:0.85,page_number:page})) };
}

const REVIEW_FIELDS=["tournament","event_level","round","scheduled_date","surface","best_of"];

function UploadPage() {
  const navigate=useNavigate();
  const [files,setFiles]=useState<File[]>([]); const [staged,setStaged]=useState<Staged[]>([]);
  const [busy,setBusy]=useState(false); const [progress,setProgress]=useState<string|null>(null);
  const visionExtract=useServerFn(extractMatchupsFromPdf); const resolveContext=useServerFn(resolveMatchContext); const executePipeline=useServerFn(runAuditPipeline);

  const enrich=async(list:Staged[])=>{
    const total=list.reduce((a,f)=>a+f.matchups.length,0); let done=0;
    for(const file of list) for(const m of file.matchups){ done++; setProgress(`Looking up match details online (${done}/${total}): ${m.player1_name} vs ${m.player2_name}…`);
      const hints:Record<string,string|null>={}; for(const key of REVIEW_FIELDS) hints[key]=m.fields.find(f=>f.field_key===key)?.normalized_value??null;
      const missing=REVIEW_FIELDS.filter(k=>!hints[k]); if(!missing.length) continue;
      try{const res=await resolveContext({data:{p1:m.player1_name,p2:m.player2_name,hints}}); if(!res.ok)continue; for(const key of missing){const value=res.fields[key];if(!value)continue;m.fields.push({field_key:key,raw_value:null,normalized_value:String(value),extraction_status:"RECONSTRUCTED",confidence:0.8,page_number:m.page_number});}}catch{/* manual review */}
    }
  };

  const analyze=async()=>{
    if(!files.length)return; setBusy(true);
    try{const next:Staged[]=[];
      for(const file of files){setProgress(`Reading ${file.name}…`);let pages:string[]=[];let matchups:ParsedMatchup[]=[];let source:Staged["source"]="TEXT";
        try{pages=(await extractPdfText(file)).pages;matchups=parseSummaryText(pages);}catch{pages=[];}

        // First fallback is free/local OCR. This is important for screenshot PDFs and
        // also preserves page_count/raw_text instead of displaying 0 pages.
        if(matchups.length===0){
          setProgress(`${file.name}: no text matchups — running free local OCR…`);
          try{const ocr=await ocrPdfLocally(file,(m)=>setProgress(`${file.name}: ${m}`)); pages=ocr.pages; matchups=parseSummaryText(pages); if(matchups.length)source="LOCAL_OCR";}catch(e){console.warn("Local OCR failed",e);}
        }

        // AI vision is now a last resort, not the only path for image-only PDFs.
        if(matchups.length===0){
          setProgress(`${file.name}: local OCR found no matchup — trying vision extraction…`);
          try{const base64=await toBase64(file);const {matchups:ai}=await visionExtract({data:{filename:file.name,base64}});matchups=ai.map(aiToParsed);source="VISION";}catch(e){
            const message=(e as Error).message;
            if(/402|credit/i.test(message)) toast.error(`${file.name}: local OCR could not identify the matchup and AI credits are exhausted.`); else toast.error(`${file.name}: ${message}`);
          }
        }
        if(matchups.length===0)toast.warning(`${file.name}: no matchups detected — review required`);
        next.push({filename:file.name,pages,matchups,source});
      }
      await enrich(next);setStaged(s=>[...s,...next]);setFiles([]);
    }catch(e){toast.error(`Analysis failed: ${(e as Error).message}`);}finally{setProgress(null);setBusy(false);}
  };

  const editField=(fi:number,mi:number,key:string,value:string)=>setStaged(s=>s.map((f,i)=>i!==fi?f:{...f,matchups:f.matchups.map((m,j)=>{if(j!==mi)return m;const exists=m.fields.some(x=>x.field_key===key);const fields=exists?m.fields.map(x=>x.field_key===key?{...x,normalized_value:value,extraction_status:"DIRECT" as const}:x):[...m.fields,{field_key:key,raw_value:null,normalized_value:value,extraction_status:"PARTIAL" as const,confidence:1,page_number:m.page_number}];return{...m,fields};})}));
  const fieldValue=(m:ParsedMatchup,key:string)=>m.fields.find(f=>f.field_key===key)?.normalized_value??"";

  const commit=async()=>{
    setBusy(true);let created=0,versions=0;const auditedMatchIds=new Set<string>();
    for(const file of staged){const {data:upload}=await supabase.from("summary_uploads").insert({filename:file.filename,page_count:file.pages.length,parse_status:"COMPLETE",raw_text:file.pages.join("\n\f\n")}).select().single();if(!upload)continue;
      for(const m of file.matchups){const key=canonicalKey({tournament:fieldValue(m,"tournament")||null,round:fieldValue(m,"round")||null,date:fieldValue(m,"scheduled_date")||null,p1:m.player1_name,p2:m.player2_name});
        const {data:existing}=await supabase.from("matches").select("id").eq("canonical_key",key).maybeSingle();let matchId=existing?.id;
        if(!matchId){const {data:match}=await supabase.from("matches").insert({canonical_key:key,player1_name:m.player1_name,player2_name:m.player2_name,tournament_name:fieldValue(m,"tournament")||null,event_level:fieldValue(m,"event_level")||null,round:fieldValue(m,"round")||null,scheduled_date:fieldValue(m,"scheduled_date")||null,surface:fieldValue(m,"surface")||null,best_of:Number(fieldValue(m,"best_of"))||null}).select().single();matchId=match?.id;if(matchId)created++;}
        if(!matchId)continue;const {data:priorVersions}=await supabase.from("summary_versions").select("id, version_number").eq("match_id",matchId).order("version_number",{ascending:false});if(priorVersions?.length)await supabase.from("summary_versions").update({is_active:false}).eq("match_id",matchId);
        const {data:version}=await supabase.from("summary_versions").insert({match_id:matchId,upload_id:upload.id,version_number:(priorVersions?.[0]?.version_number??0)+1,page_number:m.page_number,is_active:true}).select().single();if(!version)continue;versions++;
        await supabase.from("matches").update({active_summary_version_id:version.id}).eq("id",matchId);if(m.fields.length)await supabase.from("parsed_summary_fields").insert(m.fields.map(f=>({summary_version_id:version.id,field_key:f.field_key,raw_value:f.raw_value,normalized_value:f.normalized_value,extraction_status:f.extraction_status,confidence:f.confidence,page_number:f.page_number})));
        await log({match_id:matchId,stage:"SUMMARY PDF INGESTION",status:"COMPLETE",output:{file:file.filename,page:m.page_number,source:file.source}});auditedMatchIds.add(matchId);
      }
    }
    let runs=0;for(const matchId of auditedMatchIds){try{for(let chunk=0;chunk<20;chunk++){const result=await executePipeline({data:{matchId}});if(!result.ok)throw new Error(result.failures[0]?.message??"Pipeline failed to start");if(result.complete||!result.nextStage)break;}runs++;}catch(e){toast.error(`Audit run failed: ${(e as Error).message}`);}}
    setBusy(false);setStaged([]);toast.success(`${created} new matches, ${versions} summary versions, ${runs} audit runs started`);navigate({to:"/app/slate"});
  };

  return <div className="space-y-4">
    <div><h1 className="text-xl font-semibold">Upload summaries & parse review</h1><p className="text-sm text-muted-foreground">Every page of every PDF is read. Nothing unreadable is guessed — correct anything below before ingesting.</p></div>
    <div className="panel space-y-3 p-4"><Input type="file" accept="application/pdf" multiple disabled={busy} onChange={e=>setFiles(Array.from(e.target.files??[]))}/><Button className="w-full sm:w-auto" onClick={analyze} disabled={busy||files.length===0}>{busy?"Analyzing…":`Start analysis${files.length?` (${files.length} PDF${files.length>1?"s":""})`:""}`}</Button>{progress&&<p className="mono-num text-xs text-muted-foreground">{progress}</p>}<p className="text-xs text-muted-foreground">Text PDFs are read directly. Image-only PDFs use free on-device OCR first; AI vision is only a last resort. No unreadable player name is guessed.</p></div>
    {staged.map((file,fi)=><section key={file.filename+fi} className="panel p-4"><h2 className="font-semibold">{file.filename} <span className="mono-num text-xs font-normal text-muted-foreground">{file.pages.length} pages · {file.matchups.length} matchups detected · {file.source}</span></h2><div className="mt-3 space-y-3">{file.matchups.map((m,mi)=><div key={mi} className="rounded-md border border-border p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{m.player1_name} <span className="text-muted-foreground">vs</span> {m.player2_name}</span><span className="mono-num text-xs text-muted-foreground">page {m.page_number} · parser confidence {(m.confidence*100).toFixed(0)}%</span></div><div className="mt-2 grid gap-2 md:grid-cols-3">{REVIEW_FIELDS.map(key=><label key={key} className="text-xs"><span className="text-muted-foreground">{key}</span><Input className="mt-1 h-8" value={fieldValue(m,key)} placeholder="UNAVAILABLE" onChange={e=>editField(fi,mi,key,e.target.value)}/></label>)}</div><p className="mono-num mt-2 text-[11px] text-muted-foreground">{m.fields.length} fields extracted (Matrix fields stay hidden until the independent conclusion is committed)</p></div>)}</div></section>)}
    {staged.length>0&&<Button onClick={commit} disabled={busy||staged.every(f=>f.matchups.length===0)}>{busy?"Ingesting & running audits…":"Ingest & run audits"}</Button>}
  </div>;
}
