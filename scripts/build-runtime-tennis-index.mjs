import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
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

// Compact immutable match-history index used only as an evidence fallback when
// production source_observations are absent. Each lane is physically isolated.
// Row layout: [date,tournament,surface,opponent,won,round,source].
const matchHistory={ATP_MAIN:{},WTA_MAIN:{},ATP_CHALLENGER:{},WTA_CHALLENGER:{}};
function addHistory(lane,player,opponent,date,tournament,surface,won,round,source){
  const key=norm(player);if(!key||!date)return;
  const bucket=matchHistory[lane][key]??=[];
  bucket.push([String(date),String(tournament??''),String(surface??''),String(opponent??''),won===true?1:won===false?0:null,String(round??''),String(source??'')]);
}
function addSymmetric(lane,a,b,date,tournament,surface,aWon,round,source){
  addHistory(lane,a,b,date,tournament,surface,aWon,round,source);
  addHistory(lane,b,a,date,tournament,surface,aWon===null?null:!aWon,round,source);
}
function winnerCode(code){const v=norm(code);if(['1','h','home','home player','home_player'].includes(v))return true;if(['2','a','away','away player','away_player'].includes(v))return false;return null;}

const out={generatedAt:new Date().toISOString(),ATP:{},WTA:{},matchHistory};
for(const [tour,rel] of sources){const path=join(root,rel);if(!existsSync(path)){console.warn('runtime index source missing',rel);continue;}const rows=parseCsv(readFileSync(path,'utf8'));for(const row of rows){const p=touch(out[tour],row.player);if(!p)continue;addBucket(p.overall,row);const s=String(row.surface??'').toLowerCase();if(s){p.surface[s]??=blank();addBucket(p.surface[s],row);}const opponent=row.opponent??row.opponent_name??'';if(opponent&&row.date){addHistory(tour==='ATP'?'ATP_MAIN':'WTA_MAIN',row.player,opponent,row.date,row.tournament??row.tourney_name,row.surface,String(row.won??'')==='1'?true:String(row.won??'')==='0'?false:null,row.round,`runtime:${tour.toLowerCase()}_main`);}}console.log(`${tour}: ${Object.keys(out[tour]).length} players indexed from ${rows.length} rows`);}

// ATP Challenger: use the already-normalized repository history, but only the
// five-year window the deterministic Evidence Coverage metric can consume.
const challengerDir=join(root,'data/public/tennismylife-challenger/normalized');
if(existsSync(challengerDir)){
  const currentYear=new Date().getUTCFullYear();let accepted=0;
  for(const file of readdirSync(challengerDir).filter(x=>/^\d{4}_challenger_normalized\.csv$/.test(x)).sort()){
    const year=Number(file.slice(0,4));if(year<currentYear-5)continue;
    for(const row of parseCsv(readFileSync(join(challengerDir,file),'utf8'))){
      if(row._dedup_status&&row._dedup_status!=='NEW_MATCH')continue;
      const winner=row.winner_name??'';const loser=row.loser_name??'';const date=row.tourney_date??'';
      if(!winner||!loser||!date)continue;
      addSymmetric('ATP_CHALLENGER',winner,loser,date,row.tourney_name,row.surface,true,row.round,'TennisMyLife ATP Challenger');accepted++;
    }
  }
  console.log(`ATP_CHALLENGER: ${accepted} repository matches indexed`);
}

// WTA Challenger / WTA 125: this is the validated production file. Refuse to
// build if a single row crosses the WTA-125 contamination firewall.
const wta125Path=join(root,'data/public/production-history/wta_challenger/matches_2021_2026.csv');
if(existsSync(wta125Path)){
  const rows=parseCsv(readFileSync(wta125Path,'utf8'));let accepted=0;
  for(const row of rows){
    if(row.tour_family!=='WTA_CHALLENGER'||row.competition_level!=='WTA_125'||row.production_scope!=='WTA_125_ONLY'||row.contamination_firewall!=='PASS'||row.classification!=='WTA_125_CHALLENGER'||row.level!=='WTA Chall'){
      throw new Error(`WTA125_CONTAMINATION_FIREWALL_BLOCKED:${row.match_key??accepted}`);
    }
    const home=row.home_player??'',away=row.away_player??'',date=row.date??'';if(!home||!away||!date)throw new Error(`WTA125_INVALID_MATCH:${row.match_key??accepted}`);
    addSymmetric('WTA_CHALLENGER',home,away,date,row.tournament,row.surface,winnerCode(row.winner_code),row.round,'Validated WTA 125 production history');accepted++;
  }
  if(accepted!==7615)throw new Error(`WTA125_ROW_COUNT_MISMATCH:${accepted}`);
  console.log(`WTA_CHALLENGER: ${accepted} validated WTA 125 matches indexed`);
}

for(const lane of Object.values(matchHistory))for(const rows of Object.values(lane))rows.sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
mkdirSync(dirname(outputPath),{recursive:true});
writeFileSync(outputPath,`// GENERATED at build time. Do not edit.\nexport default ${JSON.stringify(out)};\n`);
console.log(`Runtime tennis index written to ${outputPath}`);
