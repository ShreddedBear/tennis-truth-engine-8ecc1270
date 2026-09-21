// Heuristic extraction of matchups + fields from Tennis Matrix summaries and
// screenshot/betting-card PDFs. Nothing is silently guessed: every field is
// reviewable before the audit starts.

export type ExtractionStatus = "DIRECT" | "RECONSTRUCTED" | "PARTIAL" | "UNAVAILABLE" | "EXCLUDED";
export interface ParsedField { field_key:string; raw_value:string|null; normalized_value:string|null; extraction_status:ExtractionStatus; confidence:number; page_number:number; }
export interface ParsedMatchup { player1_name:string; player2_name:string; page_number:number; fields:ParsedField[]; confidence:number; metadata_provenance?:Record<string,{source:string|null;method:string;status:string;direct:boolean}>; }

// Deliberately requires the literal word "vs"/"v."/"versus" — every real
// matchup title observed (betting cards and the app's own reports alike)
// spells it out. A bare em/en-dash used to count too, which was harmless for
// clean text but a serious false-positive risk once OCR gets noisy: dense
// screenshots are full of dashes as dividers/bullets/table borders, and any
// two nearby capitalized phrases separated by a stray one would otherwise
// register as a fake "matchup" (e.g. two unrelated section headings).
// "/" is included in the name-character class so a doubles title line like
// "Derepasko/Lomakin vs Matsuda/Sharma" captures each full team instead of
// only the single surname adjacent to "vs" (the "/" would otherwise break
// the run of name characters mid-team, silently dropping both other partners).
const VS=/([A-ZÀ-Ý][\p{L}'’.\-/ ]{1,55}?)\s+(?:vs\.?|v\.|versus)\s+([A-ZÀ-Ý][\p{L}'’.\-/ ]{1,55})/iu;
const NOISE=/^(?:tennis|today|tomorrow|live|open|closed|volume|vol|atp|wta|itf|challenger|moneyline|spread|total|draw|market|starts?|ends?)\b/i;
const EVENTISH=/\b(?:ATP|WTA|ITF|Challenger|Cincinnati|Cancun|US Open|Wimbledon|Roland Garros|Australian Open)\b/i;
// Best-effort only: OCR/text-layer output from a dense app screenshot is far less
// reliable than the vision extraction path (pdf-extract.functions.ts) for anything beyond
// clearly-labelled top-level text. Only scalar, prominently-printed values are attempted
// here; the structured per-module "Full Engine Breakdown" content (Surface Elo, Serve &
// Return, Recent Form, Fatigue Index, Rest/Travel/Injury, Head-to-Head, Style Matchup
// detail) is vision-only -- see AiMatrixSummary / flattenMatrixSummary in upload.tsx.
//
// The app's own "Full Engine Breakdown" match-report screenshots repeat these
// exact section headings on every page. OCR noise on a dense page can produce
// a stray "vs"-like fragment between two of them, so they're excluded as
// player-name candidates by exact phrase rather than by generic shape (a
// generic 2-6-word title-case check can't otherwise tell "Model Votes" apart
// from a real two-word name).
const UI_CHROME_PHRASES=new Set(["model votes","monte carlo simulation","full engine breakdown","surface elo","serve return","serve and return","recent form","head to head","head-to-head","market consensus","general model","specialist model","set score distribution","fatigue index","match load recovery","rest travel injury","style matchup","builder check","bet score","win probability","data quality","model agreement","close matchup","independent conclusion","key tech view","score history","spot odds risk",
 // Table-style "OCR verification" page column headers (# | PLAYER 1 | PLAYER 2 | EVENT DATA).
 // "PLAYER 1"/"PLAYER 2" already fail the digit check in looksLikeFullPlayerName; "EVENT DATA"
 // has no digit and is plain title-case text, so without this it would itself be picked up as
 // a fake "name" and thrown into the no-vs pairing sequence, offsetting every real pair after it.
 "event data","player 1","player 2",
 // Two-word surface labels that repeat once per data row on a real table page (discovered via
 // real-fixture OCR validation: a real reference sheet prints "Indoor Hard" above every row of
 // an indoor-hard section). Single-word surfaces ("Clay"/"Hard"/"Grass") already fail the
 // >=2-word check in looksLikeSingleNameShape and never needed listing here, but a two-word
 // surface passes that same shape check and, printed once per row, silently offsets every
 // pair after it by one -- the exact cascading misalignment a stray candidate here causes.
 "indoor hard","outdoor hard","indoor clay","outdoor clay","hard court","clay court","grass court"]);
function isUiChromePhrase(s:string){return UI_CHROME_PHRASES.has(s.toLowerCase().replace(/[.,:&-]/g," ").replace(/\s+/g," ").trim());}
const FIELD_PATTERNS:Array<[string,RegExp]>=[
 ["tournament",/(?:tournament|event)\s*[:\-]\s*(.+)/i],["event_level",/(?:event level|level|category)\s*[:\-]\s*(.+)/i],["round",/round\s*[:\-]\s*(.+)/i],["scheduled_date",/(?:date|scheduled)\s*[:\-]\s*(.+)/i],["surface",/surface\s*[:\-]\s*(.+)/i],["indoor_outdoor",/(indoor|outdoor)\s*[:\-]?\s*(.*)/i],["best_of",/best[\s\-]?(?:of)?\s*[:\-]?\s*([35])/i],
 ["matrix_predicted_winner",/predicted winner\s*[:\-]\s*(.+)/i],["matrix_wp",/(?:win probability|matrix wp|wp)\s*[:\-]\s*([\d.]+)\s*%?/i],["matrix_wp_range",/\brange\s+(\d{1,3}\s*[-–]\s*\d{1,3})/i],["matrix_confidence_label",/\b(extreme|very high|high confidence|low confidence|no strong signal)\b/i],["matrix_agreement_label",/\b(strongly agree|high disagreement|close to a coin flip|moderate lean)\b/i],["monte_carlo_winner",/monte carlo winner\s*[:\-]\s*(.+)/i],["monte_carlo_prob",/monte carlo (?:win )?(?:probability|prob)\s*[:\-]\s*([\d.]+)/i],["monte_carlo_expected_sets",/expected sets\s*[:\-]\s*([\d.]+)/i],["monte_carlo_simulations",/simulations(?: run)?\s*[:\-]\s*([\d,]+)/i],["data_quality",/(?:data quality|dq)\s*[:\-]\s*(.+)/i],["upset_risk",/upset risk\s*[:\-]\s*(.+)/i],["model_agreement",/(?:model )?agreement\s*[:\-]\s*(.+)/i]
];
function cleanLine(v:string){return v.replace(/[|]/g," ").replace(/\s+/g," ").trim();}
// Card subtitles read "Today @ 8:10am · ATP Challenger Roehampton 2" (OCR often
// truncates/mangles "Today" and the separator, e.g. "day @ 8:18am. ATP
// Challenger..."). Left unstripped, this whole line used to get stored as the
// tournament value, and it also broke the "starts with ATP/WTA/ITF" event_level
// checks below. Matched generically on "leading word + @ + time" rather than
// enumerating day names, since OCR truncation of "Today" is unpredictable —
// no real tournament name is followed directly by an "@ H:MM" time.
const SCHEDULE_PREFIX=/^\S{1,10}\s*@?\s*\d{1,2}:\d{2}\s*(?:am|pm)?[\s.]*[-·:•]?\s*/i;
function cleanTournament(v:string){return cleanLine(v).replace(/^\$?[\d,]+\s*(?:vol(?:ume)?)?\s*/i,"").replace(/^vol(?:ume)?\s*/i,"").replace(SCHEDULE_PREFIX,"").trim();}
// Betting-card rows show a small flag/rank icon immediately to the left of each
// player's name; OCR frequently reads that icon as one or two short stray
// letter-tokens glued onto the real name (e.g. "s K Oliver Tarvet", "NE oliver
// Tarvet"). A genuine leading initial always carries a period ("J. Smith"), so a
// bare 1-2 letter token with no period in front of a real word is safe to drop.
// The stray token itself may include a misread digit (an icon read as "4"),
// but the lookahead still requires the actual name that follows to be pure
// letters — this only ever strips the noise, never a real odds/price line.
const ICON_NOISE_PREFIX=/^(?:[A-Za-zÀ-ÿ0-9]{1,2}\s+){1,2}(?=[\p{L}]{3,}\s+[\p{L}])/u;
// Title-case each letter run independently (not split on apostrophe/hyphen as
// a whole token) so "O'Connor" and "Auger-Aliassime" keep the letters after the
// punctuation capitalized instead of being lowercased as one long "word".
const titleCase=(v:string)=>v.replace(/\p{L}+/gu,w=>w[0].toUpperCase()+w.slice(1).toLowerCase());
// A doubles row in the table-style "OCR verification" page prints each team
// as "Surname1 / Surname2" in a single cell (e.g. "Derepasko / Lomakin").
// That "/" is not a name character, so without special-casing it here the
// whole cell fails the name-shape check below and both doubles teams vanish
// from the block's candidate pool entirely -- silently losing all 4 doubles
// players from a match that otherwise never even shows up as an "orphan"
// (its partner cell fails the same way, so the pair-count stays even and
// nothing looks wrong). Normalizing " / " to "/" (no surrounding spaces)
// gives a stable, singular representation a downstream doubles-aware
// identity resolver can split on, while still reading as one player1_name/
// player2_name pair to everything upstream that only knows about two sides.
const SLASH=/\s*\/\s*/;
function cleanPlayer(v:string){return titleCase(cleanLine(v).replace(/^[^A-Za-zÀ-ÿ]{0,4}/,"").replace(ICON_NOISE_PREFIX,"").replace(/^(?:BEE|SE|s|a)\s+(?=[A-ZÀ-Ý])/i,"").replace(/\s+[+\-−]\s*\d{2,4}\s*$/," ").replace(/\s+/g," ").trim()).replace(SLASH,"/");}
function looksLikeSingleNameShape(s:string,minWords:number){const words=s.split(/\s+/).filter(Boolean);return words.length>=minWords&&words.length<=6&&words.every(w=>/^[\p{L}][\p{L}'’.\-]*$/u.test(w));}
function looksLikeFullPlayerName(line:string){const s=cleanPlayer(line);if(!s||s.length<4||s.length>60||NOISE.test(s)||EVENTISH.test(s)||isUiChromePhrase(s))return false;if(/\d|\$|@|%|\bvol\b/i.test(s))return false;
 if(s.includes("/")){const teams=s.split("/");return teams.length===2&&teams.every(t=>looksLikeSingleNameShape(t,1));}
 return looksLikeSingleNameShape(s,2);}
function add(out:ParsedField[],key:string,value:string,page:number,confidence=.9){const v=cleanLine(value);if(v&&!out.some(f=>f.field_key===key))out.push({field_key:key,raw_value:v,normalized_value:v,extraction_status:"DIRECT",confidence,page_number:page});}
function fieldsFromBlock(block:string,page:number){const out:ParsedField[]=[];for(const[key,re]of FIELD_PATTERNS){const m=block.match(re);if(!m)continue;const raw=(m[1]??"").trim().replace(/\s{2,}.*$/,"");if(raw)add(out,key,key==="tournament"?cleanTournament(raw):raw,page);}
 const lines=block.split(/\n/).map(cleanLine).filter(Boolean);
 const eventRaw=lines.find(l=>EVENTISH.test(l)&&!/\bvs\b/i.test(l));if(eventRaw){const event=cleanTournament(eventRaw);if(event)add(out,"tournament",event,page,.85);if(/challenger/i.test(event))add(out,"event_level","Challenger",page,.9);else if(/\bATP\b/i.test(event))add(out,"event_level","ATP",page,.8);else if(/\bWTA\b/i.test(event))add(out,"event_level","WTA",page,.8);else if(/\bITF\b/i.test(event))add(out,"event_level","ITF",page,.8);}
 const when=lines.find(l=>/@?\s*\d{1,2}:\d{2}\s*(?:am|pm)\b/i.test(l));if(when)add(out,"scheduled_date",when,page,.8);
 const vol=lines.join(" ").match(/\$\s*([\d,]+)\s*vol/i);if(vol)add(out,"market_volume",`$${vol[1]}`,page,.95);
 const odds=lines.join(" ").match(/[+\-−]\s*\d{2,4}/g)?.map(x=>x.replace(/\s+/g,""))??[];if(odds[0])add(out,"p1_moneyline",odds[0],page,.9);if(odds[1])add(out,"p2_moneyline",odds[1],page,.9);
 return out;}
function canonicalNamesAroundAnchor(lines:string[],anchor:number,p1Hint:string,p2Hint:string):[string,string]{const window=lines.slice(anchor+1,Math.min(lines.length,anchor+12)).map(cleanLine);const names=window.filter(looksLikeFullPlayerName).map(cleanPlayer);if(names.length>=2)return[names[0],names[1]];const p1=cleanPlayer(p1Hint),p2=cleanPlayer(p2Hint);
 // The anchor line itself matched "X vs Y", but neither side turned out to be
 // a real nearby full name — only accept the hint text directly if it isn't
 // one of the app's own known section headings (a stray dash-like OCR
 // artifact between two headings would otherwise register as a "vs" match).
 if(isUiChromePhrase(p1)||isUiChromePhrase(p2))return["",""];
 return[p1,p2];}
// A page with no literal "vs"/"v."/"versus" anchor is not necessarily a
// single matchup -- a table-style "OCR verification" page (a header row of
// "PLAYER 1 | PLAYER 2 | EVENT DATA" followed by many data rows, one pair of
// name cells per row, no "vs" text anywhere) is exactly this shape, and a
// real page commonly holds a dozen matches across one or more tournament
// sections. The previous implementation returned only the first two
// name-like lines on the whole page and silently discarded every other
// match on it -- on a 10-13 match table page that dropped 90%+ of the
// matches with no error, no warning, nothing: they just never appeared
// downstream. Multiple tournament sections can also share one page (see the
// real fixture below), each needing its own tournament/round/surface
// fields, so lines are first split into per-section blocks at each EVENTISH
// header line (mirroring how the "vs"-anchor branch already scopes fields
// per matchup block) and pairing happens independently within each block.
//
// Within a block, every name-like line is treated as one half of a
// consecutive pair (row-major order: name1, name2, name1, name2, ...),
// matching the same consecutive-pairing heuristic already used by the
// sibling OCR-text parser (rawTextParser.ts Strategy 2) for the identical
// "no separator between two names" situation. A leftover unpaired name at
// the end of a block (an odd count -- almost always a single OCR-missed
// partner) is never dropped silently: it is still emitted as its own
// PARTIAL matchup with an empty second name and an explicit warning field,
// so a human reviewing the staged import sees it and fixes/confirms it
// instead of the match vanishing without a trace.
interface InferredBlock{startLine:number;endLine:number;pairs:Array<[string,string]>;orphan:string|null;}
function splitIntoEventBlocks(lines:string[]):Array<{start:number;end:number}>{
  const headerIdx:number[]=[];
  lines.forEach((l,i)=>{if(EVENTISH.test(l)&&!VS.test(l)&&!looksLikeFullPlayerName(l))headerIdx.push(i);});
  if(!headerIdx.length)return[{start:0,end:lines.length}];
  const blocks:Array<{start:number;end:number}>=[];
  if(headerIdx[0]>0)blocks.push({start:0,end:headerIdx[0]});
  headerIdx.forEach((idx,k)=>{const end=headerIdx[k+1]??lines.length;blocks.push({start:idx,end});});
  return blocks;
}
function inferPairsWithoutVs(lines:string[]):InferredBlock[]{
  const blocks=splitIntoEventBlocks(lines);
  return blocks.map(({start,end})=>{
    const slice=lines.slice(start,end);
    const candidates=slice.filter(looksLikeFullPlayerName).map(cleanPlayer);
    const unique=candidates.filter((n,i,a)=>a.findIndex(x=>normalizeName(x)===normalizeName(n))===i);
    const pairs:Array<[string,string]>=[];
    let i=0;
    for(;i+1<unique.length;i+=2)pairs.push([unique[i],unique[i+1]]);
    const orphan=i<unique.length?unique[i]:null;
    return{startLine:start,endLine:end,pairs,orphan};
  });
}
export function parseSummaryText(pages:string[]){const matchups:ParsedMatchup[]=[];pages.forEach((pageText,idx)=>{const page=idx+1;const lines=pageText.split(/\n/).map(cleanLine).filter(Boolean);const anchors:number[]=[];lines.forEach((l,i)=>{if(VS.test(l))anchors.push(i);});if(anchors.length){anchors.forEach((anchorIdx,k)=>{const nextAnchor=anchors[k+1]??lines.length;const block=lines.slice(anchorIdx,nextAnchor).join("\n");const m=lines[anchorIdx].match(VS);if(!m)return;const[p1,p2]=canonicalNamesAroundAnchor(lines,anchorIdx,m[1]??"",m[2]??"");if(!p1||!p2)return;const fields=fieldsFromBlock(block,page);matchups.push({player1_name:p1,player2_name:p2,page_number:page,fields,confidence:Number(Math.min(1,.72+fields.length*.03).toFixed(2))});});return;}
 const inferredBlocks=inferPairsWithoutVs(lines);
 for(const{startLine,endLine,pairs,orphan}of inferredBlocks){
  if(!pairs.length&&!orphan)continue;
  const blockText=lines.slice(startLine,endLine).join("\n");
  const fields=fieldsFromBlock(blockText,page);
  for(const[p1,p2]of pairs)matchups.push({player1_name:p1,player2_name:p2,page_number:page,fields,confidence:Number(Math.min(.95,.75+fields.length*.03).toFixed(2))});
  if(orphan){
   // A single unmatched name-like line at the end of a block: almost always
   // one match whose second name OCR never produced a name-shaped line.
   // Surfacing it (rather than dropping it) is what lets a reviewer see
   // "N matches detected, 1 needs a name" instead of quietly losing a row.
   const orphanFields=[...fields,{field_key:"__unpaired_name_warning",raw_value:orphan,normalized_value:"Second player name not detected on this page -- verify against source image",extraction_status:"PARTIAL" as const,confidence:.3,page_number:page}];
   matchups.push({player1_name:orphan,player2_name:"",page_number:page,fields:orphanFields,confidence:.3});
  }
 }
});return matchups;}
export function normalizeName(name:string){return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z ]/g,"").replace(/\s+/g," ").trim();}
export function canonicalKey(parts:{tournament?:string|null;round?:string|null;date?:string|null;p1:string;p2:string;}){const players=[normalizeName(parts.p1),normalizeName(parts.p2)].sort().join("|");return[(parts.tournament??"unknown").toLowerCase().trim(),(parts.round??"unknown").toLowerCase().trim(),(parts.date??"unknown").toLowerCase().trim(),players].join("::");}
