// Pure matchup helpers shared by the upload review screen and by server-side ingestion.
//
// These were defined inside routes/app/upload.tsx, which was fine while ingestion also ran
// in the browser. Ingestion is now a server function, and both halves need the SAME
// definitions of "is this the same matchup" and "is this context compatible" -- two
// divergent copies would let the reviewer dedupe one way and the ingester another.
import { normalizeName, type ParsedMatchup } from "./summary-parser";

export const REVIEW_FIELDS=["tournament","event_level","round","scheduled_date","surface","best_of"];
export const clean=(v:string|null|undefined)=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export const nameTokens=(v:string)=>normalizeName(v).split(" ").filter(Boolean);
export function samePlayer(a:string,b:string){const x=nameTokens(a),y=nameTokens(b);if(!x.length||!y.length)return false;if(x.join(" ")===y.join(" "))return true;const xl=x[x.length-1],yl=y[y.length-1];if(xl!==yl)return false;const sx=new Set(x),sy=new Set(y);const overlap=[...sx].filter(t=>sy.has(t)).length;const shorter=Math.min(sx.size,sy.size);return overlap===shorter||overlap>=Math.min(2,shorter);}
export function samePair(a1:string,a2:string,b1:string,b2:string){return(samePlayer(a1,b1)&&samePlayer(a2,b2))||(samePlayer(a1,b2)&&samePlayer(a2,b1));}
export function compatible(a:string|null|undefined,b:string|null|undefined){const x=clean(a),y=clean(b);return !x||!y||x===y||x.includes(y)||y.includes(x);}
export function richness(m:ParsedMatchup){return REVIEW_FIELDS.filter(k=>m.fields.some(f=>f.field_key===k&&f.normalized_value)).length+m.fields.length*.01+m.player1_name.split(" ").length*.001+m.player2_name.split(" ").length*.001;}
export function mergeParsed(a:ParsedMatchup,b:ParsedMatchup){const primary=richness(b)>richness(a)?b:a,secondary=primary===a?b:a;const fields=[...primary.fields];for(const f of secondary.fields)if(!fields.some(x=>x.field_key===f.field_key&&x.normalized_value))fields.push(f);const longer=(x:string,y:string)=>nameTokens(y).length>nameTokens(x).length?y:x;return{...primary,player1_name:longer(primary.player1_name,secondary.player1_name),player2_name:longer(primary.player2_name,secondary.player2_name),fields};}
export function dedupeMatchups(matchups:ParsedMatchup[]){const out:ParsedMatchup[]=[];for(const m of matchups){const i=out.findIndex(x=>samePair(x.player1_name,x.player2_name,m.player1_name,m.player2_name));if(i<0)out.push(m);else out[i]=mergeParsed(out[i],m);}return out;}
export function setResolvedField(m:ParsedMatchup,key:string,value:string){const i=m.fields.findIndex(f=>f.field_key===key);const next={field_key:key,raw_value:i>=0?m.fields[i].raw_value:null,normalized_value:value,extraction_status:"RECONSTRUCTED" as const,confidence:.9,page_number:m.page_number};if(i>=0)m.fields[i]={...m.fields[i],...next};else m.fields.push(next);}

