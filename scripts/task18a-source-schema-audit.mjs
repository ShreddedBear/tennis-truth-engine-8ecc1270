import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const root=process.cwd();
const specs=[
 ['ATP_MAIN','data/public/predixsport/atp/atp_elo_matches.csv'],
 ['WTA_MAIN','data/public/predixsport/wta/wta_elo_ratings.csv'],
 ['WTA_CHALLENGER','data/public/production-history/wta_challenger/matches_2021_2026.csv'],
];
const cdir=join(root,'data/public/tennismylife-challenger/normalized');
if(existsSync(cdir)){const f=readdirSync(cdir).filter(x=>/^\d{4}_challenger_normalized\.csv$/.test(x)).sort().at(-1);if(f)specs.push(['ATP_CHALLENGER',`data/public/tennismylife-challenger/normalized/${f}`]);}
function firstTwo(path){const text=readFileSync(path,'utf8');const lines=text.split(/\r?\n/).filter(Boolean).slice(0,2);return{header:lines[0]??'',sample:lines[1]??''};}
for(const [lane,rel] of specs){const path=join(root,rel);if(!existsSync(path)){console.log(`${lane}:MISSING:${rel}`);continue;}const {header,sample}=firstTwo(path);console.log(`SCHEMA ${lane} ${rel}\nHEADER=${header}\nSAMPLE=${sample.slice(0,2000)}`);}
