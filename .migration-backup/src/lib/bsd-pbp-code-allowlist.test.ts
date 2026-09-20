import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression guard for the wiring gap docs/audit-task-026-034-053.md fixes: 034 and 053
// are fully computed by reconstructPbpScoreState but were silently dropped from every live
// packet because three of the four bsd-*-pbp.server.ts files' PBP_CODES allowlist never
// named them. This asserts the allowlist Set literal itself -- a genuinely static list,
// not an implementation detail prone to reasonable refactor -- names both codes in each
// of the three lanes that actually call reconstructPbpScoreState.
const RECONSTRUCTED_LANES = ["bsd-atp-main-pbp.server.ts", "bsd-atp-challenger-pbp.server.ts", "bsd-wta-main-pbp.server.ts"];

describe("bsd-*-pbp.server.ts PBP_CODES allowlists include 034 and 053", () => {
  for (const file of RECONSTRUCTED_LANES) {
    it(`${file} allows codes 034 and 053 through to its packet`, () => {
      const src = readFileSync(`src/lib/${file}`, "utf8");
      const match = src.match(/const PBP_CODES=new Set\(\[([^\]]*)\]/);
      expect(match, `${file} must define a PBP_CODES allowlist`).not.toBeNull();
      const codes = match![1];
      expect(codes, `${file} PBP_CODES`).toContain('"034"');
      expect(codes, `${file} PBP_CODES`).toContain('"053"');
    });
  }

  it("bsd-wta-challenger-pbp.server.ts intentionally excludes 034/053 (no per-game chronology in that lane's approved rows) rather than silently allowing them", () => {
    const src = readFileSync("src/lib/bsd-wta-challenger-pbp.server.ts", "utf8");
    const match = src.match(/const LEGACY_PBP_CODES=new Set\(\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    const codes = match![1];
    expect(codes).not.toContain('"034"');
    expect(codes).not.toContain('"053"');
    expect(src).toContain("no per-game");
  });
});
