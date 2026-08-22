import {supabaseAdmin as db} from "@/integrations/supabase/client.server";
const {data:r}=await db.from("audit_runs").select("id,run_number,status").eq("match_id","3a7d6305-ef2b-4e47-8f91-d9825413382a").order("run_number",{ascending:false}).limit(1);
console.log(r);
const {data:s}=await db.from("audit_stage_runs").select("stage,status,done_count,total_count,error_message").eq("audit_run_id",r?.[0]?.id??"");
for(const x of s??[])console.log(x.stage,x.status,`${x.done_count}/${x.total_count}`,x.error_message??"");
const {data:m}=await db.from("metric_results").select("status,p1_treatment,p2_treatment").eq("audit_run_id","ef725e4a-a6c9-4774-b2dc-bb0775a6fb86");
const c:Record<string,number>={};for(const x of m??[])c[x.status]=(c[x.status]??0)+1;
console.log("metric rows",m?.length,c);
