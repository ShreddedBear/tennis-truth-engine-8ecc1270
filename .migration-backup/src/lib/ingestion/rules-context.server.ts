import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertObservationFamily } from "../metric-source-family-policy";

const db = supabaseAdmin as any;
export type RulesSource = "itf_rules" | "atp_rules" | "wta_rules";

type Target={id:string;source_id:RulesSource;target_key:string;pullback_start:string|null;pullback_end:string|null;config:Record<string,unknown>|null};

type Observation={
  source_id:string;source_name:string;source_url:string;source_record_key:string;
  player_name:null;opponent_name:null;tournament:null;event_date:string|null;surface:null;
  observation_type:"RULES_CONTEXT";observation_key:string;text_value:string;numeric_value:null;
  unit:null;sample_label:string|null;window_start:string|null;window_end:string|null;
  raw_payload:unknown;provenance:Record<string,unknown>;
};

const DEFAULT_URLS:Record<RulesSource,string>={
  itf_rules:"https://www.itftennis.com/en/about-us/governance/rules-and-regulations/",
  atp_rules:"https://www.atptour.com/",
  wta_rules:"https://www.wtatennis.com/",
};
const SOURCE_NAMES:Record<RulesSource,string>={itf_rules:"ITF Rules and Regulations",atp_rules:"ATP Official Rules Context",wta_rules:"WTA Official Rules Context"};

function cleanText(html:string){
  return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&amp;|&quot;|&#39;/g," ").replace(/\s+/g," ").trim();
}

function extractRuleFacts(text:string){
  const patterns:[string,RegExp][]=[
    ["best_of_context",/best[- ]of[- ](?:three|five)|best of (?:3|5)/ig],
    ["tiebreak_context",/tie[- ]?break|tiebreak/ig],
    ["retirement_walkover_context",/retirement|walkover|withdrawal/ig],
    ["suspension_delay_context",/suspension|suspended|delay|interruption/ig],
    ["coaching_context",/coaching|coach/ig],
    ["ball_change_context",/ball change|change of balls|new balls/ig],
  ];
  return patterns.flatMap(([key,re])=>{
    const matches=[...text.matchAll(re)].slice(0,12).map(m=>m[0]);
    return matches.length?[{key,count:matches.length,matches}]:[];
  });
}

export async function ingestRulesContext(source:RulesSource){
  const {data:targets,error}=await db.from("ingestion_targets").select("id,source_id,target_key,pullback_start,pullback_end,config").eq("source_id",source).eq("enabled",true); if(error)throw error;
  let pages_read=0,observations_written=0;
  for(const target of (targets??[]) as Target[]){
    const cfg=target.config??{}; const url=typeof cfg.url==="string"&&cfg.url?cfg.url:DEFAULT_URLS[source];
    const r=await fetch(url,{headers:{"user-agent":"TennisTruthEngine/1.0 (+warehouse ingestion)",accept:"text/html,*/*"}}); if(!r.ok)throw new Error(`${url} returned ${r.status}`);
    const html=await r.text(); pages_read++; const text=cleanText(html); const facts=extractRuleFacts(text);
    const rows:Observation[]=[];
    for(const fact of facts){
      const row:Observation={source_id:source,source_name:SOURCE_NAMES[source],source_url:url,source_record_key:`${target.target_key}:${fact.key}`,player_name:null,opponent_name:null,tournament:null,event_date:target.pullback_end??new Date().toISOString().slice(0,10),surface:null,observation_type:"RULES_CONTEXT",observation_key:fact.key,text_value:JSON.stringify({count:fact.count,matches:fact.matches}),numeric_value:null,unit:null,sample_label:`objective rules text matches=${fact.count}`,window_start:target.pullback_start,window_end:target.pullback_end,raw_payload:{excerpt:text.slice(0,12000)},provenance:{target_key:target.target_key,extraction:"official_rules_page_text",objective_only:true}};
      assertObservationFamily(row,"RULES_CONTEXT"); rows.push(row);
    }
    for(let i=0;i<rows.length;i+=250){const chunk=rows.slice(i,i+250);const {error:e}=await db.from("source_observations").upsert(chunk,{onConflict:"source_id,source_record_key",ignoreDuplicates:false});if(e)throw e;observations_written+=chunk.length;}
    await db.from("ingestion_targets").update({last_ingested_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",target.id);
  }
  return {source,targets:targets?.length??0,pages_read,observations_written};
}
