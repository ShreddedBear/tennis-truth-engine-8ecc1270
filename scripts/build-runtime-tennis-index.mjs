import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root=process.cwd();
const outputArg=process.argv[2];
const outputPath=outputArg?resolve(root,outputArg):join(root,'src/generated/tennis-runtime-index.ts');
const sources=[['ATP','data/public/predixsport/atp/atp_elo_matches.csv'],['WTA','data/public/predixsport/wta/wta_elo_ratings.csv']];
function parseCsv(text){const rows=[];let r=[],c='',q=false;for(let i=0;i<text.length;i++){const x=text[i];if(x==='"'){if(q&&text[i+1]==='"'){c+='"';i++;}else q=!q;}else if(x===','&&!q){r.push(c);c='';}else if((x==='\n'||x==='\r')&&!q){if(x==='\r'&&text[i+1]==='\n')i++;r.push(c);c='';if(r.some(Boolean))rows.push(r);r=[];}else c+=x;}if(c||r.length){r.push(c);rows.push(r);}if(!rows.length)return[];const h=rows[0].map(x=>x.trim());return rows.slice(1).map(a=>Object.fromEntries(h.map((k,i)=>[k,(a[i]??'').trim()])));}
function norm(v){return String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function blank(){return{n:0,w:0,l:0,sets:0,setsWon:0,straightWins:0,deciding:0,decidingWins:0,elo:null,peak:null,lastDate:null,recent:[]};}
function touch(map,name){const key=norm(name);if(!key)return null;if(!map[key])map[key]={name,overall:blank(),surface:{}};return map[key];}
function addBucket(b,row){b.n++;const won=String(row.won??'')==='1';if(row.won!==undefined&&row.won!==''){won?b.w++:b.l++;}const sf=num(row.sets_for),sa=num(row.sets_against);if(sf!==null&&sa!==null){b.sets+=sf+sa;b.setsWon+=sf;if(won&&sa===0)b.straightWins++;if(sf+sa===3||sf+sa===5){b.deciding++;if(won)b.decidingWins++;}}const elo=num(row.elo_post)??num(row.elo_pre)??num(row.elo);if(elo!==null){b.elo=elo;b.peak=b.peak===null?elo:Math.max(b.peak,elo);}const d=row.date||'';if(d&&(!b.lastDate||d>b.lastDate))b.lastDate=d;b.recent.push([d,won?1:0,String(row.surface??'').toLowerCase(),elo,row.opponent??row.opponent_name??'',row.tournament??'']);if(b.recent.length>20)b.recent.shift();}
const out={generatedAt:new Date().toISOString(),ATP:{},WTA:{}};
for(const [tour,rel] of sources){const path=join(root,rel);if(!existsSync(path)){console.warn('runtime index source missing',rel);continue;}const rows=parseCsv(readFileSync(path,'utf8'));for(const row of rows){const p=touch(out[tour],row.player);if(!p)continue;addBucket(p.overall,row);const s=String(row.surface??'').toLowerCase();if(s){p.surface[s]??=blank();addBucket(p.surface[s],row);}}console.log(`${tour}: ${Object.keys(out[tour]).length} players indexed from ${rows.length} rows`);}
mkdirSync(dirname(outputPath),{recursive:true});
writeFileSync(outputPath,`// GENERATED at build time. Do not edit.\nexport default ${JSON.stringify(out)};\n`);
console.log(`Runtime tennis index written to ${outputPath}`);
