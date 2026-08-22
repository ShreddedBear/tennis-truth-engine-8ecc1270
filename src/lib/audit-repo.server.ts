// Supabase-backed implementation of the audit pipeline data contract.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LOCAL_WORKSPACE_ID } from "./constants";
import { hybridResearcher } from "./hybrid-audit-research.server";
import { STAGES, type ChildTable, type PipelineDeps, type RunRow, type Stage } from "./audit-pipeline";

const OWNER = LOCAL_WORKSPACE_ID;

async function ownerId(): Promise<string> { return OWNER; }

export async function makeDeps(): Promise<PipelineDeps> {
  const user_id = await ownerId();
  const db = supabaseAdmin;
  return {
    now: () => new Date(), research: hybridResearcher,
    async getMatch(matchId) { const { data } = await db.from("matches").select("*").eq("id", matchId).maybeSingle(); return (data as never) ?? null; },
    async updateMatch(matchId, patch) { const { error } = await db.from("matches").update(patch as never).eq("id", matchId); if (error) throw new Error(`Database update failed (matches): ${error.message}`); },
    async getParsedFields(matchId) { const { data: sv } = await db.from("summary_versions").select("id").eq("match_id", matchId).eq("is_active", true).maybeSingle(); if (!sv) return {}; const { data } = await db.from("parsed_summary_fields").select("field_key, normalized_value, raw_value").eq("summary_version_id", sv.id); const out: Record<string,string> = {}; for (const row of data ?? []) { const v=row.normalized_value??row.raw_value; if(v) out[row.field_key]=v; } return out; },
    async getActiveVersionId(docType) { const { data } = await db.from("rule_documents").select("active_version_id").eq("doc_type",docType).maybeSingle(); return data?.active_version_id ?? null; },
    async getRules(versionId) { const { data } = await db.from("rules").select("id, rule_code, rule_name, body, severity, blocking").eq("version_id",versionId).order("rule_code"); return (data??[]) as never; },
    async getLatestRun(matchId) { const { data } = await db.from("audit_runs").select("*").eq("match_id",matchId).order("run_number",{ascending:false}).limit(1); return ((data?.[0] as never)??null) as RunRow|null; },
    async createRun(row) { const { data,error }=await db.from("audit_runs").insert({...row,user_id} as never).select().single(); if(error||!data)throw new Error(`Could not create audit run: ${error?.message}`); return data as never; },
    async updateRun(runId,patch){const{error}=await db.from("audit_runs").update(patch as never).eq("id",runId);if(error)throw new Error(`Database update failed (audit_runs): ${error.message}`);},
    async list(table:ChildTable,runId){const{data,error}=await db.from(table).select("*").eq("audit_run_id",runId);if(error)throw new Error(`Database read failed (${table}): ${error.message}`);return(data??[])as never;},
    async insert(table:ChildTable,rows){for(let i=0;i<rows.length;i+=200){const{error}=await db.from(table).insert(rows.slice(i,i+200).map(r=>({...r,user_id}))as never);if(error)throw new Error(`Database insert failed (${table}): ${error.message}`);}},
    async update(table:ChildTable,id,patch){const{error}=await db.from(table).update(patch as never).eq("id",id);if(error)throw new Error(`Database update failed (${table}): ${error.message}`);},
    async getStages(runId){const{data}=await db.from("audit_stage_runs").select("stage, status, attempts, error_message, done_count, total_count").eq("audit_run_id",runId);return(data??[])as never;},
    async setStage(runId,matchId,stage:Stage,patch){const{error}=await db.from("audit_stage_runs").upsert({audit_run_id:runId,match_id:matchId,stage,stage_order:STAGES.indexOf(stage),user_id,...patch}as never,{onConflict:"audit_run_id,stage"});if(error)throw new Error(`Database write failed (audit_stage_runs): ${error.message}`);},
    async saveIdentityRecords(matchId,rows){await db.from("match_identity_records").delete().eq("match_id",matchId).in("field",rows.map(r=>String(r["field"])));await db.from("match_identity_records").insert(rows.map(r=>({...r,match_id:matchId,user_id}))as never);},
    async saveSnapshots(runId,rows){if(!rows.length)return;await db.from("source_snapshots").insert(rows.map(r=>({...r,audit_run_id:runId,user_id}))as never);},
    async saveConflicts(runId,rows){if(!rows.length)return;await db.from("source_conflicts").insert(rows.map(r=>({...r,audit_run_id:runId,user_id}))as never);},
    async getCalibration(){const{data:version}=await db.from("calibration_versions").select("id, label, version_number").eq("is_active",true).order("version_number",{ascending:false}).limit(1).maybeSingle();if(!version)return{version:null,buckets:[]};const{data:buckets}=await db.from("calibration_buckets").select("bucket_code, wp_min, wp_max, wins, graded").eq("calibration_version_id",version.id).order("wp_min");return{version,buckets:(buckets??[])as never};},
    async getDecisionId(runId){const{data}=await db.from("final_decisions").select("id").eq("audit_run_id",runId).maybeSingle();return data?.id??null;},
    async saveDecision(runId,existingId,payload){if(existingId){const{error}=await db.from("final_decisions").update(payload as never).eq("id",existingId);if(error)throw new Error(`Database update failed (final_decisions): ${error.message}`);}else{const{error}=await db.from("final_decisions").insert({...payload,user_id}as never);if(error)throw new Error(`Database insert failed (final_decisions): ${error.message}`);}},
    async getConflicts(runId){const{data}=await db.from("source_conflicts").select("critical, resolution_status").eq("audit_run_id",runId);return(data??[])as never;},
    async getReconstructions(runId){const{data}=await db.from("reconstruction_results").select("status").eq("audit_run_id",runId);return(data??[])as never;},
    async saveCoverage(runId,rows){const{error}=await db.from("audit_coverage").upsert(rows.map(row=>({...row,user_id}))as never,{onConflict:"audit_run_id,player_side"});if(error)throw new Error(`Database write failed (audit_coverage): ${error.message}`);},
    async saveCoverageRates(runId, rows) {
      const registryRows=[...new Map(rows.map(row=>[String(row["metric_code"]),{metric_code:String(row["metric_code"]),metric_name:String(row["metric_name"]??row["metric_code"]),lifecycle_status:"ACTIVE",tour_eligibility:[]}])).values()];
      const{error:registryError}=await db.from("metric_registry").upsert(registryRows as never,{onConflict:"metric_code"});if(registryError)throw new Error(`Database write failed (metric_registry): ${registryError.message}`);
      // metric_name belongs in metric_registry, not metric_coverage_rates.
      const coverageRows=rows.map(row=>({metric_code:row["metric_code"],player_side:row["player_side"],treatment:row["treatment"],usable:row["usable"],recorded_at:row["recorded_at"],audit_run_id:runId,user_id}));
      const{error}=await db.from("metric_coverage_rates").upsert(coverageRows as never,{onConflict:"metric_code,player_side,audit_run_id"});if(error)throw new Error(`Database write failed (metric_coverage_rates): ${error.message}`);
    },
    async log(entry){await db.from("execution_logs").insert({user_id,audit_run_id:(entry["audit_run_id"]as string)??null,match_id:(entry["match_id"]as string)??null,stage:String(entry["stage"]),status:String(entry["status"]),output:(entry["output"]??null)as never,matrix_visible:Boolean(entry["matrix_visible"])}as never);},
  };
}
