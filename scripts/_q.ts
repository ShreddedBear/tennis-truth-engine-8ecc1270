import {makeDeps} from "@/lib/audit-repo.server";
import {runPipeline} from "@/lib/audit-pipeline";
const id="3a7d6305-ef2b-4e47-8f91-d9825413382a";
const deps=await makeDeps();
const r=await runPipeline(deps,id,{budgetMs:200000});
console.log(r.runId,r.complete,r.nextStage);
console.log(r.stages.map(s=>`${s.stage}: ${s.status} ${s.detail}`).join("\n"));
