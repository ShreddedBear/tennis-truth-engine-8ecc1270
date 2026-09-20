import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enforceMetricWiring072076 } from "./metric-wiring-072-076.server";
import type { MetricFinding } from "./audit-pipeline";

const players={p1:"Player One",p2:"Player Two"};
const sources=[
  {source_name:"Official Tour",url:"https://example.test/official",retrieved_at:"2026-08-22T00:00:00Z"},
  {source_name:"Charted Dataset",url:null,retrieved_at:"2026-08-22T00:00:00Z"},
];
function row(code:string,p1:string|null,p2:string|null,sourceList=sources):MetricFinding{return{
  metric_code:code,p1_value:p1,p2_value:p2,p1_treatment:"PARTIAL",p2_treatment:"PARTIAL",differential:null,evidence_family:`EXACT_${code}`,reliability:90,sample:"legacy",unavailable_reason:null,sources:sourceList,
};}

describe("072-076 side-specific provenance and orientation",()=>{
  it("is preserved in the actual production researcher chain",()=>{
    const repo=readFileSync("src/lib/audit-repo.server.ts","utf8");
    const warehouse=readFileSync("src/lib/warehouse-first-researcher.server.ts","utf8");
    const finalLayer=readFileSync("src/lib/metric-wiring-078-081.server.ts","utf8");
    const completion=readFileSync("src/lib/completion-sweep-research.server.ts","utf8");
    expect(repo).toContain('import { warehouseFirstResearcher } from "./warehouse-first-researcher.server"');
    expect(repo).toContain("research: warehouseFirstResearcher");
    expect(warehouse).toContain('import { finalMetricWiringResearcher } from "./metric-wiring-078-081.server"');
    expect(warehouse).toContain("...finalMetricWiringResearcher");
    expect(warehouse).toContain("finalMetricWiringResearcher.metrics");
    expect(finalLayer).toContain('import { metricWiring072076Researcher } from "./metric-wiring-072-076.server"');
    expect(finalLayer).toContain("...metricWiring072076Researcher");
    expect(finalLayer).toContain("await metricWiring072076Researcher.metrics");
    expect(completion).toContain('import { certifyMetricFinding } from "./metric-certification"');
    expect(completion).toContain("certifyMetricFinding(enforceFiveMetricWiring");
  });

  it("rejects swapped P1/P2 identity even when the metric text itself is semantically valid",()=>{
    const out=enforceMetricWiring072076(row(
      "072",
      "PLAYER=Player Two; SOURCE=Official Tour; SAMPLE=career profile; verified one-handed backhand type",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=career profile; verified two-handed backhand type",
    ),players);
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.p1_value).toBeNull();
    expect(out.p2_value).toBeNull();
    expect(out.unavailable_reason).toContain("exact PLAYER");
  });

  it("requires each side to tag a source that actually exists in persisted provenance",()=>{
    const out=enforceMetricWiring072076(row(
      "073",
      "PLAYER=Player One; SOURCE=Unrelated Blog; SAMPLE=pre-match interview; player public statement",
      "PLAYER=Player Two; SOURCE=Official Tour; SAMPLE=pre-match interview; player public statement",
    ),players);
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("PARTIAL");
    expect(out.sources).toEqual([sources[0]]);
  });

  it("requires public-context metrics to use a real public URL, not internal/model provenance",()=>{
    const internal=[{source_name:"Matrix Summary",url:null,retrieved_at:"2026-08-22T00:00:00Z"}];
    const out=enforceMetricWiring072076(row(
      "075",
      "PLAYER=Player One; SOURCE=Matrix Summary; SAMPLE=event context; official deciding-set tiebreak format",
      "PLAYER=Player Two; SOURCE=Matrix Summary; SAMPLE=event context; official deciding-set tiebreak format",
      internal,
    ),players);
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("allows specialized 074 evidence from a named local/charted source while keeping side provenance exact",()=>{
    const out=enforceMetricWiring072076(row(
      "074",
      "PLAYER=Player One; SOURCE=Charted Dataset; SAMPLE=42 observed serves; charted serve toss consistency",
      "PLAYER=Player Two; SOURCE=Charted Dataset; SAMPLE=37 observed serves; charted serve toss consistency",
    ),players);
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
    expect(out.sources).toEqual([sources[1]]);
    expect(out.sample).toContain("P1:42 observed serves");
    expect(out.sample).toContain("P2:37 observed serves");
  });

  it("does not let one side's valid source/sample satisfy the opponent",()=>{
    const out=enforceMetricWiring072076(row(
      "076",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=day order of play; official order of play first on court",
      "PLAYER=Player Two; SOURCE=Missing Source; SAMPLE=day order of play; official court assignment stadium",
    ),players);
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.p2_value).toBeNull();
  });
});
