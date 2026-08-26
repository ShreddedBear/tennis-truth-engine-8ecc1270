import type { MetricFinding, SourceRef } from "./audit-pipeline";
import { normalizeEvidenceIdentity } from "./evidence-player-alias";
import { buildCanonicalEvidenceMatchIdentity, classifyEvidenceTourFamily, type EvidenceTourFamily } from "./evidence-match-identity";
import { repositoryHistoryAvailable, repositoryResultsRows, type RepositoryResultsObservation } from "./repository-results-history.server";
import { deriveHistoricalResultMetric, TASK18A_HISTORICAL_RESULTS_CODES, type HistoricalResultRow } from "./historical-results-recovery";

const OWNED=new Set<string>(TASK18A_HISTORICAL_RESULTS_CODES);
function codeOf(v:unknown){const m=String(v??"").match(/(\d{1,3})$/);return m?m[1].padStart(3,"0"):String(v??"").padStart(3,"0");}
function contextSurface(context:string|null|undefined){const m=String(context??"").match(/(?:^|[|·;])\s*surface\s*[:=]?\s*(hard|clay|grass|carpet)\b/i);return m?m[1]:null;}
function canonicalKey(value:string|null|undefined){return normalizeEvidenceIdentity(String(value??""));}
function parsePayload(row:RepositoryResultsObservation){const p=row.raw_payload??{};const d=(p.history_detail&&typeof p.history_detail==="object"?p.history_detail:{}) as Record<string,unknown>;const n=(v:unknown)=>{const x=Number(v);return Number.isFinite(x)&&v!==null&&v!==""?x:null;};const pairs=Array.isArray(d.set_scores)?d.set_scores.flatMap(v=>Array.isArray(v)&&v.length>=2&&Number.isFinite(Number(v[0]))&&Number.isFinite(Number(v[1]))?[[Number(v[0]),Number(v[1])] as [number,number]]:[]):[];return {winner:canonicalKey(String(p.winner??""))||null,detail:{setsFor:n(d.sets_for),setsAgainst:n(d.sets_against),setScores:pairs,bestOf:n(d.best_of),opponentRank:n(d.opponent_rank),opponentElo:n(d.opponent_elo),status:d.status==null?null:String(d.status)}};}
function historicalRows(rows:RepositoryResultsObservation[]):HistoricalResultRow[]{return rows.flatMap(row=>{if(!row.event_date||!row.player_name||!row.opponent_name)return[];const player=canonicalKey(row.player_name),opponent=canonicalKey(row.opponent_name);if(!player||!opponent)return[];const parsed=parsePayload(row);const won=parsed.winner===player?true:parsed.winner===opponent?false:null;return[{date:row.event_date,player,opponent,won,surface:row.surface,tournament:row.tournament,...parsed.detail}];});}
function refs(rows:RepositoryResultsObservation[]):SourceRef[]{const seen=new Set<string>();const out:SourceRef[]=[];for(const row of rows){const k=row.source_name;if(seen.has(k))continue;seen.add(k);out.push({source_name:k,url:null,retrieved_at:null});}return out;}

export async function deterministicHistoricalResultsMetric(args:{metricCode:string;p1:string;p2:string;asOfDate:string;tournament?:string|null;surface?:string|null;tourFamily?:EvidenceTourFamily|null;context?:string|null;}):Promise<MetricFinding|null>{
  const code=codeOf(args.metricCode);if(!OWNED.has(code))return null;
  const family=args.tourFamily??classifyEvidenceTourFamily(args.context,args.tournament);if(!family)return null;
  if(!repositoryHistoryAvailable(args.p1,family)||!repositoryHistoryAvailable(args.p2,family))return null;
  const p1Rows=repositoryResultsRows(args.p1,family,args.asOfDate,{strictBefore:true});const p2Rows=repositoryResultsRows(args.p2,family,args.asOfDate,{strictBefore:true});if(!p1Rows.length||!p2Rows.length)return null;
  const allObs=[...p1Rows,...p2Rows];const rows=historicalRows(allObs);const surface=args.surface??contextSurface(args.context);const p1=canonicalKey(args.p1),p2=canonicalKey(args.p2);if(!p1||!p2||p1===p2)return null;
  const a=deriveHistoricalResultMetric({code,player:p1,opponent:p2,rows,asOfDate:args.asOfDate,surface});const b=deriveHistoricalResultMetric({code,player:p2,opponent:p1,rows,asOfDate:args.asOfDate,surface});if(!a||!b||a.sampleSize<=0||b.sampleSize<=0)return null;
  const treatment=code==="057"?"PARTIAL":"RECONSTRUCTED";if(a.treatment!==treatment||b.treatment!==treatment)return null;
  const canonical=buildCanonicalEvidenceMatchIdentity({player1Name:args.p1,player2Name:args.p2,tournament:args.tournament,date:args.asOfDate,tour:family});
  const provenance={metric:code,tour_family:family,target_match:canonical.key,surface,cutoff:`strictly before ${args.asOfDate}`,p1:{raw_inputs:a.rawInputs,transformation:a.transformation,output:a.value,sample_size:a.sampleSize},p2:{raw_inputs:b.rawInputs,transformation:b.transformation,output:b.value,sample_size:b.sampleSize}};
  return {metric_code:code,p1_value:a.value,p2_value:b.value,p1_treatment:treatment,p2_treatment:treatment,differential:null,evidence_family:"RESULTS_HISTORY",reliability:treatment==="PARTIAL"?72:92,sample:JSON.stringify(provenance),unavailable_reason:treatment==="PARTIAL"?"Retirement/walkover status is only credited for rows with explicitly preserved status; missing status is never treated as a normal completion.":null,sources:refs(allObs)};
}