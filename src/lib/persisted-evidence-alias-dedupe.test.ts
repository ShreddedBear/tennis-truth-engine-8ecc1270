import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8").replace(/\s+/g, " ");

describe("persisted evidence alias dedupe", () => {
  it("recovers equivalent duplicate alias rows", () => {
    expect(source).toContain("function unambiguousStoredRow(rows:StoredEvidence[])");
    expect(source).toContain("signatures.size===1?rows[0]:null");
  });

  it("fails closed when duplicate rows disagree", () => {
    expect(source).toContain("JSON.stringify([row.treatment,row.value_text,row.evidence_family,row.unavailable_reason])");
    expect(source).toContain("if(selected)out.set(code,selected)");
  });
});
