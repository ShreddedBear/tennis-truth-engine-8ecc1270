#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "src/lib/evidence-coverage-runtime-diagnostic.server.ts"
TEST = ROOT / "src/lib/evidence-coverage-runtime-diagnostic.test.ts"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 patch target, found {count}")
    return text.replace(old, new, 1)


runtime = RUNTIME.read_text()
runtime = replace_once(
    runtime,
    'import { deterministicPbpMetric } from "./deterministic-pbp-metrics.server";',
    'import { deterministicPbpMetric, deterministicPbpMetricFromPacket } from "./deterministic-pbp-metrics.server";',
    "PBP packet import",
)
runtime = replace_once(
    runtime,
    'buildMetricObservationContext({metrics,p1:match.p1,p2:match.p2,asOfDate:match.date})',
    'buildMetricObservationContext({metrics,p1:match.p1,p2:match.p2,asOfDate:match.date,context:match.context})',
    "canonical context propagation",
)
runtime = replace_once(
    runtime,
    'function chooseEvidenceSide(stored:any,deterministic:any,internal:any,side:"p1"|"p2"){\n  const candidates=[\n    {treatment:stored?.treatment,value:stored?.value_text,source:"stored"},\n    {treatment:deterministic?.[`${side}_treatment`],value:deterministic?.[`${side}_value`],source:"deterministic"},\n    {treatment:internal?.[`${side}_treatment`],value:internal?.[`${side}_value`],source:"certified_local"},\n  ];',
    'function chooseEvidenceSide(stored:any,deterministic:any,repositoryPbp:any,internal:any,side:"p1"|"p2"){\n  const candidates=[\n    {treatment:stored?.treatment,value:stored?.value_text,source:"stored"},\n    {treatment:deterministic?.[`${side}_treatment`],value:deterministic?.[`${side}_value`],source:"deterministic"},\n    {treatment:repositoryPbp?.[`${side}_treatment`],value:repositoryPbp?.[`${side}_value`],source:"repository_pbp"},\n    {treatment:internal?.[`${side}_treatment`],value:internal?.[`${side}_value`],source:"certified_local"},\n  ];',
    "repository PBP evidence precedence",
)
runtime = replace_once(
    runtime,
    '    const localByCode=await deterministicBatch(metrics,match);\n',
    '    const localByCode=await deterministicBatch(metrics,match);\n    const repositoryPbpByCode=new Map(metrics.map(metric=>{const code=codeOf(metric.code);return [code,deterministicPbpMetricFromPacket({metricCode:code,p1:match.p1,p2:match.p2,asOfDate:match.date,packet})] as const;}));\n',
    "repository PBP deterministic map",
)
runtime = replace_once(
    runtime,
    'local=localByCode.get(code)??{row:null,errors:[]},internal=',
    'local=localByCode.get(code)??{row:null,errors:[]},repositoryPbp=repositoryPbpByCode.get(code)??null,internal=',
    "repository PBP metric candidate",
)
runtime = replace_once(
    runtime,
    'p1Chosen=chooseEvidenceSide(p1Stored,local.row,p1Internal,"p1"),p2Chosen=chooseEvidenceSide(p2Stored,local.row,p2Internal,"p2")',
    'p1Chosen=chooseEvidenceSide(p1Stored,local.row,repositoryPbp,p1Internal,"p1"),p2Chosen=chooseEvidenceSide(p2Stored,local.row,repositoryPbp,p2Internal,"p2")',
    "repository PBP side selection",
)
runtime = replace_once(
    runtime,
    'deterministic_family:local.row?.evidence_family??internal?.evidence_family??historicalInternal?.evidence_family??null',
    'deterministic_family:repositoryPbp?.evidence_family??local.row?.evidence_family??internal?.evidence_family??historicalInternal?.evidence_family??null',
    "repository PBP family provenance",
)
RUNTIME.write_text(runtime)

test = TEST.read_text()
test = replace_once(
    test,
    'expect(diagnostic).toContain(\'import { deterministicPbpMetric } from "./deterministic-pbp-metrics.server"\');',
    'expect(diagnostic).toContain(\'import { deterministicPbpMetric, deterministicPbpMetricFromPacket } from "./deterministic-pbp-metrics.server"\');',
    "runtime PBP import assertion",
)
test = replace_once(
    test,
    'expect(diagnostic).toContain("deterministicPbpMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date})");',
    'expect(diagnostic).toContain("deterministicPbpMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date})");\n    expect(diagnostic).toContain("deterministicPbpMetricFromPacket({metricCode:code,p1:match.p1,p2:match.p2,asOfDate:match.date,packet})");\n    expect(diagnostic).toContain("source:\"repository_pbp\"");\n    expect(diagnostic).toContain("asOfDate:match.date,context:match.context");',
    "runtime repository PBP assertions",
)
TEST.write_text(test)
