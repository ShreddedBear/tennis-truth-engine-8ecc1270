import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const root=process.cwd();
const specs=[
 ['ATP_MAIN','data/public/predixsport/atp/atp_elo_matches.csv'],
 ['WTA_MAIN','data/public/predixsport/wta/wta_elo_ratings.csv'],
 ['WTA_CHALLENGER','data/public/production-history/wta_challenger/matches_2021_2026.csv'],
];
const cdir=join(root,'data/public/tennismylife-challenger/normalized');
if(existsSync(cdir)){const f=readdirSync(cdir).filter(x=>/^\d{4}_challenger_normalized\.csv$/.test(x)).sort().at(-1);if(f)specs.push(['ATP_CHALLENGER',`data/public/tennismylife-challenger/normalized/${f}`]);}
function firstTwo(path){const text=readFileSync(path,'utf8');const lines=text.split(/\r?\n/).filter(Boolean).slice(0,2);return{header:lines[0]??'',sample:lines[1]??''};}
const audit={generated_at:new Date().toISOString(),sources:{}};
for(const [lane,rel] of specs){const path=join(root,rel);if(!existsSync(path)){audit.sources[lane]={path:rel,missing:true};continue;}const {header,sample}=firstTwo(path);audit.sources[lane]={path:rel,missing:false,header,columns:header.split(','),sample:sample.slice(0,4000)};console.log(`SCHEMA ${lane} ${rel}\nHEADER=${header}\nSAMPLE=${sample.slice(0,2000)}`);}
const out=join(root,'docs/evidence-coverage/task18a-source-schema-audit.json');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(audit,null,2)+'\n');console.log(`Wrote ${out}`);
