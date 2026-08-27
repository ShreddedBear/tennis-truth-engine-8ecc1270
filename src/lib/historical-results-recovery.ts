import type { Treatment } from "./audit-pipeline";

// Task 20 reconciliation:
// - "024" was retargeted to "008" (see the code==="008" branch below). Real code 024
//   is "Hidden Performance Quality" (metric-certification.ts already has a correctly
//   real-catalog-aligned policy for it -- point/game-level performance, expected vs.
//   actual conversion, shot-quality inputs); a deciding-set win rate has nothing to do
//   with that, but is an exact bullet match for real code 008 ("Set Profile":
//   "Set-3/Deciding-Set Win Rate"), which had no engine of its own.
// - "022" and "025" were removed with no retarget. Real 022 ("Serve/Return Shot-Level
//   Efficiency") and 025 ("Match Deterioration Metrics") both already have correctly
//   real-catalog-aligned metric-certification.ts policies requiring shot-level/serve-
//   decay data this repository does not have; their best plausible real homes (the
//   H2H/tiebreak content computed here) are either non-existent (022) or already
//   claimed and shadowed by higher-priority PBP evidence for the same code (025 ->
//   009, whose "Pressure-Point Performance" bullet already wins via Task 18B). Removing
//   them here lets both correctly fall through to their existing, stricter
//   certification-gated handling instead of being shadowed by this file's mismatched
//   credit, consistent with the code 069 fix.
export const TASK18A_HISTORICAL_RESULTS_CODES = [
  "006","008","010","011","013","020","023","045","046","049","050","051","052","053","054","055","056","057","058","059","080",
] as const;

export type Task18aMetricCode = (typeof TASK18A_HISTORICAL_RESULTS_CODES)[number];
export type SetScore = [number, number];
export type HistoricalResultRow = {
  date: string;
  player: string;
  opponent: string;
  won: boolean | null;
  surface: string | null;
  tournament: string | null;
  setsFor: number | null;
  setsAgainst: number | null;
  setScores: SetScore[];
  bestOf: number | null;
  opponentRank: number | null;
  opponentElo: number | null;
  status: string | null;
};

export type HistoricalDerivation = {
  value: string;
  treatment: Treatment;
  sampleSize: number;
  rawInputs: Record<string, unknown>;
  transformation: string;
};

const pct = (n:number,d:number) => d > 0 ? Number((100*n/d).toFixed(2)) : null;
const avg = (xs:number[]) => xs.length ? Number((xs.reduce((a,b)=>a+b,0)/xs.length).toFixed(3)) : null;
const variance = (xs:number[]) => { if(xs.length<2)return 0;const m=xs.reduce((a,b)=>a+b,0)/xs.length;return Number((xs.reduce((s,x)=>s+(x-m)**2,0)/xs.length).toFixed(4)); };
const surfaceKey=(v:string|null|undefined)=>String(v??"").trim().toLowerCase();
const isCompleted=(r:HistoricalResultRow)=>r.won!==null&&!/(walkover|w\/o|wo\b|cancel)/i.test(r.status??"");
const scored=(r:HistoricalResultRow)=>r.setsFor!==null&&r.setsAgainst!==null;
const setRows=(r:HistoricalResultRow)=>r.setScores.length?r.setScores:(scored(r)?[]:[]);
const totalSets=(r:HistoricalResultRow)=>r.setsFor!==null&&r.setsAgainst!==null?r.setsFor+r.setsAgainst:(r.setScores.length?r.setScores.length:null);
const dayDiff=(a:string,b:string)=>Math.floor((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000);
const quality=(r:HistoricalResultRow)=>r.opponentRank!==null?`rank:${r.opponentRank}`:r.opponentElo!==null?`elo:${r.opponentElo}`:null;
const qualityBand=(r:HistoricalResultRow)=>r.opponentRank!==null?(r.opponentRank<=10?"rank_1_10":r.opponentRank<=50?"rank_11_50":r.opponentRank<=100?"rank_51_100":"rank_101_plus"):r.opponentElo!==null?(r.opponentElo>=2000?"elo_2000_plus":r.opponentElo>=1800?"elo_1800_1999":"elo_below_1800"):null;
const blowoutSet=([a,b]:SetScore)=>Math.abs(a-b)>=4;
const bagelSet=([a,b]:SetScore)=>a===0||b===0;
const tiebreakSet=([a,b]:SetScore)=>(a===7&&b===6)||(a===6&&b===7);

function completed(rows:HistoricalResultRow[]){return rows.filter(isCompleted);}
function withSurface(rows:HistoricalResultRow[], surface?:string|null){const s=surfaceKey(surface);return s?rows.filter(r=>surfaceKey(r.surface)===s):rows;}
function baseRecord(rows:HistoricalResultRow[]){const c=completed(rows);const wins=c.filter(r=>r.won===true).length;return {matches:c.length,wins,losses:c.length-wins,winPct:pct(wins,c.length)};}
function scoreSummary(rows:HistoricalResultRow[]){
  const c=completed(rows).filter(scored);const wins=c.filter(r=>r.won===true);const straightWins=wins.filter(r=>r.setsAgainst===0).length;
  const setsLost=c.map(r=>r.setsAgainst!).filter(Number.isFinite);const setScores=c.flatMap(setRows);const tb=setScores.filter(tiebreakSet);const bagels=setScores.filter(bagelSet);const blowouts=setScores.filter(blowoutSet);
  return {matches:c.length,wins:wins.length,straightWins,straightWinPct:pct(straightWins,wins.length),setsLostPerMatch:avg(setsLost),sets:setScores.length,tiebreakSets:tb.length,bagelSets:bagels.length,blowoutSets:blowouts.length,gamesPerSet:avg(setScores.map(([a,b])=>a+b))};
}
function rankedRecord(rows:HistoricalResultRow[]){
  const usable=completed(rows).filter(r=>qualityBand(r)!==null);const bands:Record<string,{w:number;n:number}>={};
  for(const r of usable){const b=qualityBand(r)!;bands[b]??={w:0,n:0};bands[b].n++;if(r.won)bands[b].w++;}
  return {matches:usable.length,bands:Object.fromEntries(Object.entries(bands).map(([k,v])=>[k,{matches:v.n,wins:v.w,winPct:pct(v.w,v.n)}]))};
}
function recent(rows:HistoricalResultRow[],asOfDate:string,days:number){return rows.filter(r=>{const d=dayDiff(r.date,asOfDate);return d>0&&d<=days;});}
function decidingRows(rows:HistoricalResultRow[]){return completed(rows).filter(r=>{const t=totalSets(r);if(t===null)return false;if(r.bestOf===3)return t===3;if(r.bestOf===5)return t===5;return false;});}
function bo3Rows(rows:HistoricalResultRow[]){return completed(rows).filter(r=>r.bestOf===3&&totalSets(r)!==null);}
function statusRows(rows:HistoricalResultRow[]){return rows.filter(r=>r.status!==null&&r.status.trim()!=="");}

export function deriveHistoricalResultMetric(args:{code:string;player:string;opponent:string;rows:HistoricalResultRow[];asOfDate:string;surface?:string|null;}):HistoricalDerivation|null {
  const code=String(args.code).padStart(3,"0") as Task18aMetricCode;
  if(!(TASK18A_HISTORICAL_RESULTS_CODES as readonly string[]).includes(code))return null;
  const history=args.rows.filter(r=>r.player===args.player&&r.date<args.asOfDate);
  if(!history.length)return null;
  const complete=completed(history);
  const record=baseRecord(history);
  const scoredRows=complete.filter(scored);
  const score=scoreSummary(history);
  const reconstruction=(value:string,sampleSize:number,rawInputs:Record<string,unknown>,transformation:string,treatment:Treatment="RECONSTRUCTED"):HistoricalDerivation=>({value,treatment,sampleSize,rawInputs,transformation});

  if(code==="006"){
    const h2h=complete.filter(r=>r.opponent===args.opponent);if(!h2h.length)return null;const w=h2h.filter(r=>r.won).length;
    return reconstruction(`h2h_matches=${h2h.length}; h2h_wins=${w}; h2h_losses=${h2h.length-w}; h2h_win_pct=${pct(w,h2h.length)??"NA"}`,h2h.length,{historical_matches_scanned:complete.length,canonical_opponent:args.opponent},"Filter canonical prior results to the opponent pair and count realized winner orientation.");
  }
  if(code==="010"){
    if(!score.matches)return null;const same=withSurface(scoredRows,args.surface);const ss=scoreSummary(same);
    return reconstruction(`scored_wins=${score.wins}; straight_set_wins=${score.straightWins}; straight_set_win_pct=${score.straightWinPct??"NA"}; same_surface_straight_set_win_pct=${ss.straightWinPct??"NA"}`,score.matches,{scored_matches:score.matches,surface:args.surface??null},"Classify completed wins with zero sets lost; separately repeat on the target surface when present.");
  }
  if(code==="011"){
    if(!score.matches||!score.sets)return null;const winSeries=complete.map(r=>r.won?1:0);const setMargins=scoredRows.map(r=>r.setsFor!-r.setsAgainst!);
    return reconstruction(`match_win_pct=${record.winPct??"NA"}; result_variance=${variance(winSeries)}; set_margin_variance=${variance(setMargins)}; straight_win_pct=${score.straightWinPct??"NA"}; blowout_set_pct=${pct(score.blowoutSets,score.sets)??"NA"}; tiebreak_set_pct=${pct(score.tiebreakSets,score.sets)??"NA"}`,score.matches,{completed_matches:complete.length,scored_matches:score.matches,set_count:score.sets},"Measure floor/volatility from realized match outcomes and observed game-level set margins, straight-set, blowout and tiebreak distributions. Full reconstruction requires preserved per-set game scores.");
  }
  if(code==="013"){
    const opponentHistory=args.rows.filter(r=>r.player===args.opponent&&r.date<args.asOfDate&&isCompleted(r));const theirs=new Set(opponentHistory.map(r=>r.opponent));const common=complete.filter(r=>r.opponent!==args.opponent&&theirs.has(r.opponent)&&quality(r)!==null);if(!common.length)return null;const w=common.filter(r=>r.won).length;
    return reconstruction(`ranked_common_opponent_matches=${common.length}; wins=${w}; win_pct=${pct(w,common.length)??"NA"}; common_opponents=${new Set(common.map(r=>r.opponent)).size}`,common.length,{common_opponents:[...new Set(common.map(r=>r.opponent))].slice(0,50),quality_labels:common.slice(0,50).map(r=>quality(r))},"Intersect canonical opponent identities across both players, require ranking/Elo quality evidence, then aggregate this player's prior results.");
  }
  if(code==="020"){
    const r=recent(history,args.asOfDate,90).filter(x=>isCompleted(x)&&quality(x)!==null);if(!r.length)return null;const q=rankedRecord(r);const w=r.filter(x=>x.won).length;
    return reconstruction(`window_days=90; quality_observed_matches=${r.length}; wins=${w}; win_pct=${pct(w,r.length)??"NA"}; bands=${JSON.stringify(q.bands)}`,r.length,{window_start_days:90,quality_observations:r.map(x=>({date:x.date,opponent:x.opponent,quality:quality(x),surface:x.surface,won:x.won})).slice(0,100)},"Use only prior 90-day realized results with observed opponent rank/Elo; preserve quality bands rather than imputing missing quality.");
  }
  if(code==="023"){
    if(!score.sets)return null;return reconstruction(`sets=${score.sets}; bagel_sets=${score.bagelSets}; bagel_set_pct=${pct(score.bagelSets,score.sets)??"NA"}; blowout_sets=${score.blowoutSets}; blowout_set_pct=${pct(score.blowoutSets,score.sets)??"NA"}`,score.matches,{scored_matches:score.matches,set_count:score.sets},"Parse player-oriented set scores; count 6-0 sets and sets with a game margin of at least four.");
  }
  if(code==="008"){
    const d=decidingRows(history);if(!d.length)return null;const w=d.filter(r=>r.won).length;return reconstruction(`deciding_matches=${d.length}; deciding_wins=${w}; deciding_set_win_pct=${pct(w,d.length)??"NA"}`,d.length,{best_of_observed:d.map(r=>r.bestOf),set_totals:d.map(totalSets)},"Use only matches whose observed best-of format and set total prove that a deciding set was played.");
  }
  if(code==="045"){
    const b=bo3Rows(history);if(!b.length)return null;const three=b.filter(r=>totalSets(r)===3).length;return reconstruction(`completed_bo3_matches=${b.length}; three_set_matches=${three}; three_set_frequency_pct=${pct(three,b.length)??"NA"}`,b.length,{best_of:3,set_totals:b.map(totalSets)},"Restrict denominator to observed best-of-three matches and count those lasting three sets.");
  }
  if(code==="046"){
    const s=surfaceKey(args.surface);if(!s)return null;const r=complete.filter(x=>surfaceKey(x.surface)===s);if(!r.length)return null;const w=r.filter(x=>x.won).length;return reconstruction(`surface=${s}; matches=${r.length}; wins=${w}; win_pct=${pct(w,r.length)??"NA"}`,r.length,{surface:s},"Filter completed historical results to the target surface and aggregate wins/losses.");
  }
  if(code==="049"||code==="050"){
    const s=code==="049"?"clay":"grass";const r=complete.filter(x=>surfaceKey(x.surface).includes(s));if(!r.length)return null;const w=r.filter(x=>x.won).length;return reconstruction(`surface=${s}; matches=${r.length}; wins=${w}; win_pct=${pct(w,r.length)??"NA"}`,r.length,{surface:s},`Filter completed historical results to ${s} and aggregate realized wins/losses.`);
  }
  if(code==="051"){
    if(!score.matches)return null;return reconstruction(`scored_matches=${score.matches}; sets_lost_per_match=${score.setsLostPerMatch??"NA"}`,score.matches,{sets_against:scoredRows.map(r=>r.setsAgainst)},"Average observed sets lost across completed matches with non-null score summaries.");
  }
  if(code==="052"){
    if(!score.sets||score.gamesPerSet===null)return null;return reconstruction(`scored_sets=${score.sets}; avg_games_per_set=${score.gamesPerSet}`,score.sets,{set_scores:scoredRows.flatMap(r=>r.setScores).slice(0,200)},"Sum games from player-oriented set score pairs and divide by observed set count.");
  }
  if(code==="053"){
    const b=bo3Rows(history).filter(r=>r.won===true);if(!b.length)return null;const straight=b.filter(r=>r.setsAgainst===0||totalSets(r)===2).length;return reconstruction(`completed_bo3_wins=${b.length}; straight_set_wins=${straight}; straight_set_win_pct=${pct(straight,b.length)??"NA"}`,b.length,{best_of:3},"Restrict to completed best-of-three wins and count wins completed without losing a set.");
  }
  if(code==="054"||code==="055"||code==="056"){
    if(!score.sets)return null;const numerator=code==="054"?score.bagelSets:code==="055"?score.blowoutSets:score.tiebreakSets;const label=code==="054"?"six_zero_set_rate_pct":code==="055"?"blowout_set_rate_pct":"tiebreaks_per_match";const value=code==="056"?Number((numerator/score.matches).toFixed(3)):pct(numerator,score.sets);return reconstruction(`scored_matches=${score.matches}; scored_sets=${score.sets}; ${label}=${value??"NA"}`,score.matches,{set_count:score.sets,numerator},code==="054"?"Count observed 6-0/0-6 set scores over all observed sets.":code==="055"?"Count observed sets with a game margin of at least four over all observed sets.":"Count observed 7-6/6-7 tiebreak sets per completed scored match.");
  }
  if(code==="057"){
    const sr=statusRows(history);if(!sr.length)return null;const rw=sr.filter(r=>/(retir|walkover|w\/o|wo\b)/i.test(r.status??"")).length;return reconstruction(`status_observed_matches=${sr.length}; retirement_or_walkover=${rw}; observed_status_rate_pct=${pct(rw,sr.length)??"NA"}`,sr.length,{status_values:sr.map(r=>r.status).slice(0,100)},"Use only rows with an explicitly preserved status field; because status preservation is incomplete, keep treatment PARTIAL.","PARTIAL");
  }
  if(code==="058"){
    const q=rankedRecord(history);if(!q.matches)return null;return reconstruction(`quality_observed_matches=${q.matches}; bands=${JSON.stringify(q.bands)}`,q.matches,{quality_bands:q.bands},"Group completed results by observed opponent ranking/Elo bands; never impute missing opponent quality.");
  }
  if(code==="059"){
    const dates=[...new Set(complete.map(r=>r.date))].sort();if(dates.length<2)return null;const gaps=dates.slice(1).map((d,i)=>dayDiff(dates[i],d));const one=gaps.filter(x=>x<=1).length,two=gaps.filter(x=>x<=2).length;return reconstruction(`transitions=${gaps.length}; rest_le_1d=${one}; rest_le_1d_rate_pct=${pct(one,gaps.length)??"NA"}; rest_le_2d=${two}; rest_le_2d_rate_pct=${pct(two,gaps.length)??"NA"}`,gaps.length,{chronological_dates:dates.slice(-200),rest_day_gaps:gaps.slice(-200)},"Sort unique prior match dates chronologically and calculate day gaps; report one-day and two-day shortfall rates without treating missing dates as zero rest.");
  }
  if(code==="080"){
    if(!score.matches||!score.sets)return null;const winSeries=complete.map(r=>r.won?1:0),setMargins=scoredRows.map(r=>r.setsFor!-r.setsAgainst!),gameMargins=scoredRows.flatMap(r=>r.setScores.map(([a,b])=>a-b));return reconstruction(`completed_matches=${complete.length}; result_variance=${variance(winSeries)}; set_margin_variance=${variance(setMargins)}; game_margin_variance=${variance(gameMargins)}`,score.matches,{match_outcomes:winSeries.slice(-200),set_margins:setMargins.slice(-200),game_margins:gameMargins.slice(-400)},"Compute population variance of prior binary match outcomes and observed set/game margins. Full reconstruction requires preserved per-set game scores; missing score components are never zero-filled.");
  }
  return null;
}
