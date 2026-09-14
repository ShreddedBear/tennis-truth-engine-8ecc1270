import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourcedStat, StatSource } from "./reconstruction/engine";

export type FreshnessStatus = "CURRENT"|"AGING"|"STALE"|"ARCHIVAL"|"UNKNOWN";
export interface FreshnessAssessment { status:FreshnessStatus; age_days:number|null; data_through:string|null; last_sync:string|null; source:string; }

type Meta={source?:string;last_sync_utc?:string|null;data_through?:string|null;mode?:"DYNAMIC"|"ARCHIVAL";current_days?:number;stale_days?:number};
const cache=new Map<string,Meta|null>();
function readMeta(path:string){if(cache.has(path))return cache.get(path)??null;try{const m=JSON.parse(readFileSync(join(process.cwd(),path),"utf8")) as Meta;cache.set(path,m);return m;}catch{cache.set(path,null);return null;}}
function metaFor(name:string):Meta|null{if(/PredixSport/i.test(name))return readMeta("data/public/predixsport/FRESHNESS.json");if(/DataHub ATP/i.test(name))return readMeta("data/public/datahub-atp/FRESHNESS.json");return null;}
function daysBetween(a:string,b:string){const x=Date.parse(`${a.slice(0,10)}T00:00:00Z`),y=Date.parse(`${b.slice(0,10)}T00:00:00Z`);return Number.isFinite(x)&&Number.isFinite(y)?Math.max(0,(x-y)/86400000):null;}
function targetDate(context:string){return context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1]??new Date().toISOString().slice(0,10);}
export function assessSourceFreshness(source:StatSource,context:string):FreshnessAssessment{const meta=metaFor(source.source_name),target=targetDate(context);if(!meta)return{status:"UNKNOWN",age_days:null,data_through:null,last_sync:source.retrieved_at??null,source:source.source_name};if(meta.mode==="ARCHIVAL")return{status:"ARCHIVAL",age_days:meta.data_through?daysBetween(target,meta.data_through):null,data_through:meta.data_through??null,last_sync:meta.last_sync_utc??null,source:source.source_name};const age=meta.data_through?daysBetween(target,meta.data_through):null,current=meta.current_days??7,stale=meta.stale_days??30;const status:FreshnessStatus=age===null?"UNKNOWN":age<=current?"CURRENT":age<=stale?"AGING":"STALE";return{status,age_days:age,data_through:meta.data_through??null,last_sync:meta.last_sync_utc??null,source:source.source_name};}
export function assessStatsFreshness(stats:SourcedStat[],context:string):FreshnessAssessment[]{const seen=new Set<string>(),out:FreshnessAssessment[]=[];for(const s of stats)for(const src of s.sources??[]){const a=assessSourceFreshness(src,context),k=`${a.source}|${a.data_through??""}`;if(!seen.has(k)){seen.add(k);out.push(a);}}return out;}
export function freshnessAdjustedReliability(base:number,assessments:FreshnessAssessment[]){if(!assessments.length)return base;if(assessments.some(a=>a.status==="CURRENT"))return base;if(assessments.some(a=>a.status==="AGING"))return Math.max(0,base-10);if(assessments.every(a=>a.status==="ARCHIVAL"))return Math.min(base,70);if(assessments.some(a=>a.status==="STALE"))return Math.max(0,base-25);return Math.max(0,base-5);}
export function freshnessLabel(assessments:FreshnessAssessment[]){if(!assessments.length)return"UNKNOWN";if(assessments.some(a=>a.status==="CURRENT"))return"CURRENT";if(assessments.some(a=>a.status==="AGING"))return"AGING";if(assessments.some(a=>a.status==="STALE"))return"STALE";if(assessments.every(a=>a.status==="ARCHIVAL"))return"ARCHIVAL";return"UNKNOWN";}
