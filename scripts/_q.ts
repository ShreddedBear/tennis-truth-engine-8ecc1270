import {supabaseAdmin as db} from "@/integrations/supabase/client.server";
const {data:m}=await db.from("matches").select("id,player1_name,player2_name,created_at,summary_upload_id").order("created_at",{ascending:false}).limit(20);
console.log(m);
const {data:r}=await db.from("audit_runs").select("id,match_id,run_number,status,created_at").order("created_at",{ascending:false}).limit(10);
console.log(r);
const {data:s}=await db.from("audit_stage_runs").select("audit_run_id,stage,status,error_message,done_count,total_count").eq("audit_run_id",r?.[0]?.id??"");
console.log(s);
const {data:mr}=await db.from("metric_results").select("p1_treatment,p2_treatment,status").limit(10);
console.log(mr);
