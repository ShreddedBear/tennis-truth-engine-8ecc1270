import {supabaseAdmin as db} from "@/integrations/supabase/client.server";
const {data,error}=await db.from("matches").select("*").order("created_at",{ascending:false}).limit(3);
console.log(error, JSON.stringify(data?.[0],null,1));
const {data:u}=await db.from("summary_uploads").select("*").order("created_at",{ascending:false}).limit(3);
console.log(JSON.stringify(u,null,1)?.slice(0,600));
const {count}=await db.from("matches").select("*",{count:"exact",head:true});
console.log("matches",count);
