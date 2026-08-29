// Supabase-backed implementation of the audit pipeline data contract.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LOCAL_WORKSPACE_ID } from "./constants";
import { warehouseFirstResearcher } from "./warehouse-first-researcher.server";
import { STAGES, type ChildTable, type PipelineDeps, type RunRow, type Stage } from "./audit-pipeline";

const OWNER = LOCAL_WORKSPACE_ID;
async function ownerId(): Promise<string> { return OWNER; }

export async function makeDeps(): Promise<PipelineDeps> {
  const user_id = await ownerId(); const db = supabaseAdmin;
  return {
    now: () => new Date(), research: warehouseFirstResearcher,
    async getMatch(matchId) { const { data } = await db.from("matches").select("*").eq("id", matchId).maybeSingle(); return (data as never) ?? null; },
    async updateMatch(matchId, patch) { const { error } = await db.from("matches").update(patch as never).eq("id", matchId); if (error) throw new Error(`Database update failed (matches): ${error.message}`); },
    async getParsedFields(matchId) { const { data: sv } = await db.from("summary_versions").select("id").eq("match_id", matchId).eq("is_active", true).maybeSingle(); if (!sv) return {}; const { data } = await db.from("parsed_summary_fields").select("field_key, normalized_value, raw_value").eq("summary_version_id", sv.id); const out: Record<string,string> = {}; for (const row of data ?? []) { const v=row.normalized_value??row.raw_value; if(v) out[row.field_key]=v; } return out; },
    async getActiveVersionId(docType) { const { data } = await db.from("rule_documents").select("active_version_id").eq("doc_type",docType).maybeSingle(); return data?.active_version_id ?? null; },
    async getRules(versionId) { const { data } = await db.from("rules").select("id, rule_code, rule_name, body, severity, blocking").eq("version_id",versionId).order("rule_code"); return (data??[]) as never; },
    async getLatestRun(matchId) { const { data } = await db.from("audit_runs").select("*").eq("match_id",matchId).order("run_number",{ascending:false}).limit(1); return ((data?.[0] as never)??null) as RunRow|null; },
    async createRun(row) { const { data,error }=await db.from("audit_runs").insert({...row,user_id} as never).select().single(); if(error||!data)throw new Error(`Could not create audit run: ${error?.message}`); return data as never; },
    async updateRun(runId,patch){const{error}=await db.from("audit_runs").update(patch as never).eq("id",runId);if(error)throw new Error(`Database update failed (audit_runs): ${error.message}`);},
    async acquireRunLease(runId,owner,leaseMs){const{data,error}=await db.rpc("claim_audit_run" as never,{p_run_id:runId,p_lease_owner:owner,p_lease_seconds:Math.ceil(leaseMs/1000)} as never);if(error)throw new Error(`Could not claim audit run: ${error.message}`);return data===true;},
    async renewRunLease(runId,owner,leaseMs){const{data,error}=await db.rpc("renew_audit_run_lease" as never,{p_run_id:runId,p_lease_owner:owner,p_lease_seconds:Math.ceil(leaseMs/1000)} as never);if(error)throw new Error(`Could not renew audit run lease: ${error.message}`);return data===true;},
    async releaseRunLease(runId,owner){const{error}=await db.rpc("release_audit_run_lease" as never,{p_run_id:runId,p_lease_owner:owner} as never);if(error)throw new Error(`Could not release audit run lease: ${error.message}`);},
    async list(table:ChildTable,runId){const{data,error}=await db.from(table).select("*").eq("audit_run_id",runId);if(error)throw new Error(`Database read failed (${table}): ${error.message}`);return(data??[])as never;},
    async insert(table:ChildTable,rows){for(let i=0;i<rows.length;i+=200){const{error}=await db.from(table).insert(rows.slice(i,i+200).map(r=>({...r,user_id}))as never);if(error)throw new Error(`Database insert failed (${table}): ${error.message}`);}},
    async update(table:ChildTable,id,patch){const{error}=await db.from(table).update(patch as never).eq("id",id);if(error)throw new Error(`Database update failed (${table}): ${error.message}`);},
    async getStages(runId){const{data,error}=await db.from("audit_stage_runs").select("stage, status, attempts, error_message, done_count, total_count, heartbeat_at, started_at, finished_at").eq("audit_run_id",runId);if(error)throw new Error(`Database read failed (audit_stage_runs): ${error.message}`);return(data??[])as never;},
    async setStage(runId,matchId,stage:Stage,patch){const heartbeat_at=patch["heartbeat_at"]??new Date().toISOString();const{error}=await db.from("audit_stage_runs").upsert({audit_run_id:runId,match_id:matchId,stage,stage_order:STAGES.indexOf(stage),user_id,heartbeat_at,...patch}as never,{onConflict:"audit_run_id,stage"});if(error)throw new Error(`Database write failed (audit_stage_runs): ${error.message}`);},
    async saveIdentityRecords(matchId,rows){await db.from("match_identity_records").delete().eq("match_id",matchId).in("field",rows.map(r=>String(r["field"])));await db.from("match_identity_records").insert(rows.map(r=>({...r,match_id:matchId,user_id}))as never);},
    async saveSnapshots(runId,rows){if(!rows.length)return;await db.from("source_snapshots").insert(rows.map(r=>({...r,audit_run_id:runId,user_id}))as never);},
    async saveConflicts(runId,rows){if(!rows.length)return;await db.from("source_conflicts").insert(rows.map(r=>({...r,audit_run_id:runId,user_id}))as never);},
    async getCalibration(versionId){let query=db.from("calibration_versions").select("id, label, version_number");query=versionId?query.eq("id",versionId):query.eq("is_active",true).order("version_number",{ascending:false}).limit(1);const{data:version,error:versionError}=await query.maybeSingle();if(versionError)throw new Error(`Database read failed (calibration_versions): ${versionError.message}`);if(!version)return{version:null,buckets:[]};const{data:buckets,error:bucketError}=await db.from("calibration_buckets").select("bucket_code, wp_min, wp_max, wins, graded").eq("calibration_version_id",version.id).order("wp_min");if(bucketError)throw new Error(`Database read failed (calibration_buckets): ${bucketError.message}`);return{version,buckets:(buckets??[])as never};},
    async getDecisionId(runId){const{data}=await db.from("final_decisions").select("id").eq("audit_run_id",runId).maybeSingle();return data?.id??null;},
    async saveDecision(runId,existingId,payload){
      const extras = {
        final_recommendation: payload["final_recommendation"] ?? null,
        independent_winner: payload["independent_winner"] ?? null,
        independent_range: payload["independent_range"] ?? null,
        calibrated_range: payload["calibrated_range"] ?? null,
        calibration_version_id: payload["calibration_version_id"] ?? null,
        calibration_wins: payload["calibration_wins"] ?? null,
        calibration_graded: payload["calibration_graded"] ?? null,
        green_locked: payload["green_locked"] ?? null,
        green_lock_reasons: payload["green_lock_reasons"] ?? [],
      };
      const persisted = {
        audit_run_id: runId,
        final_audit_color: payload["final_audit_color"] ?? null,
        final_selection: payload["final_selection"] ?? payload["final_recommendation"] ?? null,
        action: payload["action"] ?? payload["final_recommendation"] ?? null,
        gate_report: { ...extras, ...((payload["gate_report"] && typeof payload["gate_report"] === "object") ? payload["gate_report"] as Record<string, unknown> : {}) },
        completion_percent: payload["completion_percent"] ?? 0,
        audit_complete: payload["audit_complete"] ?? true,
        matrix_firewall_valid: payload["matrix_firewall_valid"] ?? false,
        calibration_bucket: payload["calibration_bucket"] ?? null,
        verified_win_rate: payload["verified_win_rate"] ?? null,
      };
      if(existingId){const{error}=await db.from("final_decisions").update(persisted as never).eq("id",existingId);if(error)throw new Error(`Database update failed (final_decisions): ${error.message}`);}else{const{error}=await db.from("final_decisions").insert({...persisted,user_id}as never);if(error)throw new Error(`Database insert failed (final_decisions): ${error.message}`);}
    },
    async getConflicts(runId){const{data}=await db.from("source_conflicts").select("critical, resolution_status").eq("audit_run_id",runId);return(data??[])as never;},
    async getReconstructions(runId){const{data}=await db.from("reconstruction_results").select("status").eq("audit_run_id",runId);return(data??[])as never;},
    async saveCoverage(runId,rows){const mapped=rows.map(row=>({audit_run_id:row["audit_run_id"]??runId,player_side:row["player_side"],direct_count:row["direct_count"]??row["direct"]??0,reconstructed_count:row["reconstructed_count"]??row["reconstructed"]??0,partial_count:row["partial_count"]??row["partial"]??0,unavailable_count:row["unavailable_count"]??row["unavailable"]??0,excluded_count:row["excluded_count"]??row["excluded"]??0,total_count:row["total_count"]??row["total"]??0,usable_coverage_percent:row["usable_coverage_percent"]??row["usablePercent"]??0,execution_completion_percent:row["execution_completion_percent"]??row["executionPercent"]??0,recorded_at:row["recorded_at"]??new Date().toISOString(),user_id}));const{error}=await db.from("audit_coverage").upsert(mapped as never,{onConflict:"audit_run_id,player_side"});if(error)throw new Error(`Database write failed (audit_coverage): ${error.message}`);},
    async saveCoverageRates(runId, rows) {
      let sourceRows = rows.filter(row => typeof row["metric_code"] === "string" && String(row["metric_code"]).trim() !== "");
      if (!sourceRows.length) {
        const { data: metrics, error: metricError } = await db.from("metric_results").select("metric_code, metric_name, p1_treatment, p2_treatment").eq("audit_run_id", runId);
        if (metricError) throw new Error(`Database read failed (metric_results coverage): ${metricError.message}`);
        const usable = (t: unknown) => ["DIRECT","RECONSTRUCTED","PARTIAL"].includes(String(t ?? ""));
        sourceRows = (metrics ?? []).flatMap(metric => {
          const code = String(metric.metric_code ?? "").trim();
          if (!code) return [];
          return [
            { metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P1", treatment: metric.p1_treatment ?? "UNAVAILABLE", usable: usable(metric.p1_treatment) },
            { metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P2", treatment: metric.p2_treatment ?? "UNAVAILABLE", usable: usable(metric.p2_treatment) },
          ];
        });
      }
      if (!sourceRows.length) return;
      const registryRows=[...new Map(sourceRows.map(row=>[String(row["metric_code"]),{metric_code:String(row["metric_code"]),metric_name:String(row["metric_name"]??row["metric_code"]),lifecycle_status:"ACTIVE",tour_eligibility:[]}])).values()];
      const{error:registryError}=await db.from("metric_registry").upsert(registryRows as never,{onConflict:"metric_code"});
      if(registryError)throw new Error(`Database write failed (metric_registry): ${registryError.message}`);
      const now=new Date().toISOString();
      const coverageRows=sourceRows.map(row=>({metric_code:String(row["metric_code"]),player_side:row["player_side"],treatment:row["treatment"]??"UNAVAILABLE",usable:Boolean(row["usable"]),recorded_at:row["recorded_at"]??now,audit_run_id:runId,user_id}));
      const{error}=await db.from("metric_coverage_rates").upsert(coverageRows as never,{onConflict:"metric_code,player_side,audit_run_id"});
      if(error)throw new Error(`Database write failed (metric_coverage_rates): ${error.message}`);
    },
    async verifyFinalPersistence(runId,expectedMetricSides,expectedAuditComplete){
      const[coverage,rates,decision]=await Promise.all([
        db.from("audit_coverage").select("player_side,total_count,usable_coverage_percent").eq("audit_run_id",runId),
        db.from("metric_coverage_rates").select("metric_code,player_side,treatment,usable").eq("audit_run_id",runId),
        db.from("final_decisions").select("id,audit_complete,completion_percent").eq("audit_run_id",runId).maybeSingle(),
      ]);
      if(coverage.error)throw new Error(`Final persistence invariant failed (audit_coverage): ${coverage.error.message}`);
      if(rates.error)throw new Error(`Final persistence invariant failed (metric_coverage_rates): ${rates.error.message}`);
      if(decision.error||!decision.data)throw new Error(`Final persistence invariant failed (final_decisions): ${decision.error?.message??"missing row"}`);
      if((coverage.data??[]).length!==2)throw new Error(`Final persistence invariant failed: expected 2 audit coverage rows, found ${(coverage.data??[]).length}.`);
      if((rates.data??[]).length!==expectedMetricSides)throw new Error(`Final persistence invariant failed: expected ${expectedMetricSides} metric coverage rows, found ${(rates.data??[]).length}.`);
      if(Boolean(decision.data.audit_complete)!==expectedAuditComplete)throw new Error("Final persistence invariant failed: decision completion flag does not match the deterministic gate.");
    },
    async log(entry){await db.from("execution_logs").insert({user_id,audit_run_id:(entry["audit_run_id"]as string)??null,match_id:(entry["match_id"]as string)??null,stage:String(entry["stage"]),status:String(entry["status"]),output:(entry["output"]??null)as never,matrix_visible:Boolean(entry["matrix_visible"])}as never);},
  };
}
