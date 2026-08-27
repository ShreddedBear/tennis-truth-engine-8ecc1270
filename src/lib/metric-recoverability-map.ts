// KNOWN DRIFT — NOT AUTHORITATIVE FOR CODE NUMBERING.
// This file's code/name pairs do not match public/seed/metrics.txt (the
// document that actually seeds the production `rules` table) — e.g. this
// file's "017 Return +1 Effectiveness" vs. the true "017 Shot & Rally
// Metrics", or "048 Outdoor Hard Win%" vs. the true "048 Independent-Evidence
// Count". Nothing outside this file's own test imports it (verified via
// repo-wide search), so it does not affect the live evidence-coverage
// diagnostic. Treat public/seed/metrics.txt + src/lib/metric-classification.ts
// as the canonical registry. This file's per-metric recoverability content
// (required_raw_fields/classification) has not been re-verified against the
// true code numbering and must not be relied on until it is rewritten.
export type RecoverabilityClass = "DIRECTLY_AVAILABLE" | "RECONSTRUCTABLE" | "PARTIAL" | "TRULY_UNAVAILABLE";

export type MetricRecoverabilityRow = {
  code: string;
  name: string;
  required_raw_fields: string;
  existing_evidence: string;
  classification: RecoverabilityClass;
  potential_treatment: "DIRECT" | "RECONSTRUCTED" | "PARTIAL" | "UNAVAILABLE";
  current_persisted_evidence_confirmed: boolean;
};

export const FOUR_TOURS = ["ATP_MAIN", "WTA_MAIN", "ATP_CHALLENGER", "WTA_CHALLENGER"] as const;
export const BASELINE_COVERAGE_PERCENT = 12.04;
export const TOTAL_COVERAGE_CELLS = 81 * FOUR_TOURS.length; // 324
// 39 / 324 = 12.037037...%, which rounds to the reported 12.04% baseline.
export const BASELINE_USABLE_CELLS = 39;
export const TARGET_USABLE_CELLS = Math.ceil(TOTAL_COVERAGE_CELLS * 0.70); // 227
export const REQUIRED_ADDITIONAL_USABLE_CELLS = TARGET_USABLE_CELLS - BASELINE_USABLE_CELLS; // 188
export const FULL_FOUR_TOUR_METRIC_EQUIVALENTS_NEEDED = REQUIRED_ADDITIONAL_USABLE_CELLS / FOUR_TOURS.length; // 47
export const COVERAGE_PP_PER_TOUR_CELL = 100 / TOTAL_COVERAGE_CELLS;
export const COVERAGE_PP_PER_FULL_FOUR_TOUR_METRIC = COVERAGE_PP_PER_TOUR_CELL * FOUR_TOURS.length;

const persisted = new Set(["001", "005", "007", "014", "020", "021", "043", "044", "058"]);
const treatment = (classification: RecoverabilityClass): MetricRecoverabilityRow["potential_treatment"] => classification === "DIRECTLY_AVAILABLE" ? "DIRECT" : classification === "RECONSTRUCTABLE" ? "RECONSTRUCTED" : classification === "PARTIAL" ? "PARTIAL" : "UNAVAILABLE";
const row = (code:string,name:string,required_raw_fields:string,existing_evidence:string,classification:RecoverabilityClass):MetricRecoverabilityRow => ({code,name,required_raw_fields,existing_evidence,classification,potential_treatment:treatment(classification),current_persisted_evidence_confirmed:persisted.has(code)});

export const METRIC_RECOVERABILITY_MAP: MetricRecoverabilityRow[] = [
row("001","Surface Strength","match date/result/surface + player/opponent identity + ranking/Elo timeline","four-tour historical results + ATP/WTA rankings + surfaces","RECONSTRUCTABLE"),
row("002","Serve Profile","server identity + point outcomes + ace/DF indicators; full profile additionally needs serve-number detail","approved BSD PBP exists on all four tour lanes; point/server outcomes support only part of the requested profile","PARTIAL"),
row("003","Return Profile","returner identity + point outcomes; full profile additionally needs serve-number detail","approved BSD PBP exists on all four tour lanes; point/server outcomes support only part of the requested profile","PARTIAL"),
row("004","Break-Point Performance","point score state + server/returner + point winner","approved BSD PBP on ATP Main/WTA Main/ATP Challenger/WTA Challenger lanes","RECONSTRUCTABLE"),
row("005","Recent Form","recent match dates/results/surface + opponent quality","four-tour historical results + ATP/WTA rankings + surfaces","RECONSTRUCTABLE"),
row("006","Head-to-Head","pair identity + prior match dates/results/surface/context","four-tour historical results","RECONSTRUCTABLE"),
row("007","Schedule / Load","match dates + sets/games + rest; full metric also needs hours/travel/time zones","results/schedules provide dates and workload components; hours/travel/time-zones are not uniformly present","PARTIAL"),
row("008","Injury / Fitness","injury/illness/medical reports + fitness-attributable retirements + recency/severity","no structured medical/injury dataset confirmed in repository or production database","TRULY_UNAVAILABLE"),
row("009","Clutch / Pressure","deciding/tiebreak/late-set point score state + point winner","approved four-tour BSD PBP plus match scorelines","RECONSTRUCTABLE"),
row("010","Straight-Set Dominance","scorelines + winner + surface","four-tour historical results with score/surface","RECONSTRUCTABLE"),
row("011","Volatility / Floor","set/game score distributions + straight-set/lopsided/TB frequencies","four-tour historical results with scorelines","RECONSTRUCTABLE"),
row("012","Environment Fit","indoor/outdoor + temperature/humidity/wind + altitude + roof/sun/ball context","event/surface/rules context exists but weather/altitude/roof fields are not uniformly present","PARTIAL"),
row("013","Common-Opponent Results","opponent identity + results + ranking/quality + surface","four-tour historical results + ATP/WTA rankings","RECONSTRUCTABLE"),
row("014","Ranking & Rating","official ranking value/date + trend","ATP and WTA ranking observations already exist in production","DIRECTLY_AVAILABLE"),
row("015","Market View","paired bookmaker odds/snapshots + vig + timestamps","no raw odds_api MARKET rows confirmed in production; persisted market rows do not cover this metric broadly","TRULY_UNAVAILABLE"),
row("016","Serve +1 Effectiveness","serve shot + next-shot outcome/placement","approved PBP exists but required next-shot sequence/placement field is not confirmed in raw PBP","TRULY_UNAVAILABLE"),
row("017","Return +1 Effectiveness","return shot + next-shot outcome","approved PBP exists but required next-shot sequence is not confirmed","TRULY_UNAVAILABLE"),
row("018","Rally-Length Profile","rally shot count + point winner","approved PBP exists but rally-length/shot-count field is not confirmed","TRULY_UNAVAILABLE"),
row("019","Scoreline Calibration","model prediction + market probability + realized result/scoreline calibration history","results exist, but raw historical market observations needed by this definition are not confirmed","TRULY_UNAVAILABLE"),
row("020","Recent Quality","recent results + opponent quality + surface","four-tour historical results + ATP/WTA rankings","RECONSTRUCTABLE"),
row("021","Elo Delta","chronological results + surface","complete chronological results can legitimately rebuild overall and surface Elo timelines","RECONSTRUCTABLE"),
row("022","H2H Similar-Conditions","H2H results + surface/conditions","four-tour historical results with surface/event context","RECONSTRUCTABLE"),
row("023","Bagel/Blowout Rate","set scores + surface","four-tour historical results with scorelines","RECONSTRUCTABLE"),
row("024","Deciding-Set Win Rate","deciding-set score/result","four-tour scorelines; approved PBP where needed","RECONSTRUCTABLE"),
row("025","Tiebreak Performance","tiebreak set/point result","four-tour scorelines + approved PBP","RECONSTRUCTABLE"),
row("026","Hold%","service games + break outcomes or PBP server/game state","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("027","Break%","return games + break outcomes or PBP","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("028","First-Serve%","first/second serve attempt indicator","raw PBP does not confirm a serve-number/first-serve-attempt field","TRULY_UNAVAILABLE"),
row("029","1st Serve Points Won%","first-serve attempt + point winner","raw PBP does not confirm a serve-number field","TRULY_UNAVAILABLE"),
row("030","2nd Serve Points Won%","second-serve attempt + point winner","raw PBP does not confirm a serve-number field","TRULY_UNAVAILABLE"),
row("031","Ace Rate","ace indicator + service points","approved four-tour BSD PBP point codes support objective ace/service-point components","RECONSTRUCTABLE"),
row("032","Double-Fault Rate","double-fault indicator + service points","approved four-tour BSD PBP point codes support objective DF/service-point components","RECONSTRUCTABLE"),
row("033","Return Points Won%","server/returner identity + point winner","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("034","1st Return Points Won%","first-serve indicator + return point winner","raw PBP does not confirm serve-number detail","TRULY_UNAVAILABLE"),
row("035","2nd Return Points Won%","second-serve indicator + return point winner","raw PBP does not confirm serve-number detail","TRULY_UNAVAILABLE"),
row("036","BP Saved%","break-point score state + service point winner","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("037","BP Converted%","break-point score state + return point winner","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("038","BP Faced/Game","break points faced + service games","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("039","BP Chances/Game","break chances + return games","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("040","Deuce Outcomes","deuce score state + point winner + server","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("041","First-Ball (<4 Shot) Win Rate","rally shot count under four + point winner","approved PBP does not confirm shot-count/rally-length data","TRULY_UNAVAILABLE"),
row("042","Extended Rally (9+) Win Rate","rally shot count nine-plus + point winner","approved PBP does not confirm shot-count/rally-length data","TRULY_UNAVAILABLE"),
row("043","Favorite Win%","closing odds below 2.00 + realized result","limited persisted PARTIAL market evidence exists; no broad raw MARKET rows confirmed","PARTIAL"),
row("044","Underdog Win%","closing odds at/above 2.00 + realized result","limited persisted PARTIAL market evidence exists; no broad raw MARKET rows confirmed","PARTIAL"),
row("045","Three-Set Frequency","match score + best-of format","four-tour historical results with scorelines","RECONSTRUCTABLE"),
row("046","Surface Match Win%","match result + surface","four-tour historical results with surface","RECONSTRUCTABLE"),
row("047","Indoor Win%","match result + indoor flag","results exist; indoor flag/context is only partially available","PARTIAL"),
row("048","Outdoor Hard Win%","match result + outdoor-hard flag","hard-court results exist; indoor/outdoor flag is not uniform","PARTIAL"),
row("049","Clay Win%","match result + clay surface","four-tour historical results with surface","RECONSTRUCTABLE"),
row("050","Grass Win%","match result + grass surface","four-tour historical results with surface","RECONSTRUCTABLE"),
row("051","Sets Lost per Match","sets lost + match count","four-tour scorelines","RECONSTRUCTABLE"),
row("052","Avg Games per Set","set game counts + set count","four-tour scorelines","RECONSTRUCTABLE"),
row("053","Straight-Set Win%","straight-set match result + completed BO3 wins","four-tour scorelines","RECONSTRUCTABLE"),
row("054","6-0 Set Rate","6-0 set scores + set count","four-tour scorelines","RECONSTRUCTABLE"),
row("055","Blowout Set Rate","set score differential + set count","four-tour scorelines","RECONSTRUCTABLE"),
row("056","Tiebreaks per Match","tiebreak sets + match count","four-tour scorelines","RECONSTRUCTABLE"),
row("057","Retirements/Walkovers Rate","retirement/walkover status + scheduled-match denominator","schedules/results exist but R/W/O status is not uniformly preserved in the runtime index","PARTIAL"),
row("058","Opponent-Quality Win%","match result + opponent ranking/Elo band","four-tour results + ATP/WTA rankings","RECONSTRUCTABLE"),
row("059","Rest-Shortfall Rate","consecutive match dates + rest-day calculation","four-tour results/schedules contain match dates","RECONSTRUCTABLE"),
row("060","Travel Load","consecutive tournament locations + coordinates/time zones + dates","tournament sequence/dates exist; coordinates/time-zone metadata is not uniformly confirmed","PARTIAL"),
row("061","Workload","rolling matches/sets/games; full metric also needs match duration","four-tour results reconstruct matches/sets/games; duration is incomplete","PARTIAL"),
row("062","Altitude Win%","event altitude + match result","results exist but event-altitude field is not confirmed in existing repository/database evidence","TRULY_UNAVAILABLE"),
row("063","Heat Win%","event temperature + match result","results exist but historical temperature field is not confirmed in existing evidence","TRULY_UNAVAILABLE"),
row("064","Cold Win%","event temperature + match result","results exist but historical temperature field is not confirmed in existing evidence","TRULY_UNAVAILABLE"),
row("065","Wind Win%","event wind + match result","results exist but historical wind field is not confirmed in existing evidence","TRULY_UNAVAILABLE"),
row("066","Humidity Win%","event humidity + match result","results exist but historical humidity field is not confirmed in existing evidence","TRULY_UNAVAILABLE"),
row("067","Roof/Indoor Transition","indoor/roof state transitions + match result","results/events exist but roof/indoor state is sparse","PARTIAL"),
row("068","Left/Right-Handed Opponent Splits","opponent handedness + match result","match results exist but handedness field is not confirmed in current evidence universe","TRULY_UNAVAILABLE"),
row("069","Dominance Ratio","point winner totals by player","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("070","Breakback Rate","game break sequence + next return-game outcome","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("071","Close-Out Rate","serving-for-set/match state + game outcome","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("072","Return Depth / Placement","return landing/depth coordinates","no tracking/landing-coordinate dataset confirmed","TRULY_UNAVAILABLE"),
row("073","Serve Placement","serve placement coordinates","no serve-coordinate tracking dataset confirmed","TRULY_UNAVAILABLE"),
row("074","Rally Direction / Patterns","shot direction/type sequence","no shot-by-shot direction/type tracking dataset confirmed","TRULY_UNAVAILABLE"),
row("075","Unforced Error Rate","unforced-error label per point/shot","no structured UE labels confirmed","TRULY_UNAVAILABLE"),
row("076","Winner Rate","winner label per point/shot","no structured shot winner labels confirmed","TRULY_UNAVAILABLE"),
row("077","Net Approach Success","net-approach indicator + outcome","no net-approach tracking dataset confirmed","TRULY_UNAVAILABLE"),
row("078","First-Strike Efficiency","serve/return first-strike shot sequence","approved PBP does not expose required shot sequence","TRULY_UNAVAILABLE"),
row("079","Pressure Index","score-state pressure points + point winner","approved four-tour BSD PBP","RECONSTRUCTABLE"),
row("080","Stability / Variance","match/set/game score history","four-tour historical results with scorelines","RECONSTRUCTABLE"),
row("081","Tournament Context","event level + draw/round + surface + indoor/outdoor/altitude context","event/tournament/round/surface exist across results/schedules; indoor/outdoor/altitude are incomplete","PARTIAL"),
];

export const RECOVERABILITY_COUNTS = METRIC_RECOVERABILITY_MAP.reduce((acc,row)=>{acc[row.classification]=(acc[row.classification]??0)+1;return acc;},{} as Record<RecoverabilityClass,number>);
export const RECOVERABLE_METRIC_CODES = METRIC_RECOVERABILITY_MAP.filter(row=>row.classification!=="TRULY_UNAVAILABLE").map(row=>row.code);
export const TRULY_UNAVAILABLE_METRIC_CODES = METRIC_RECOVERABILITY_MAP.filter(row=>row.classification==="TRULY_UNAVAILABLE").map(row=>row.code);

// Priority order deliberately follows the requested attack order. It is a candidate queue,
// not permission to count evidence. Runtime recovery must still prove pair-complete evidence
// independently for each tour/metric cell before coverage can increase.
export const RECOVERY_PRIORITY_CODES = [
  "006","010","011","013","020","022","023","024","025","045","046","049","050","051","052","053","054","055","056","057","058","059","080",
  "004","009","026","027","031","032","033","036","037","038","039","040","069","070","071","079","002","003",
  "001","005","007","014","021","061",
  "012","047","048","067","081","060",
  "043","044"
] as const;
