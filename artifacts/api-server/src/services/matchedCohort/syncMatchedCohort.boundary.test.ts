import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Static proof of the matched-cohort leakage firewall (same grep-based technique as
 * scripts/checkParlayBoundary.ts and parlayPaperTrading/statisticsBoundary.test.ts).
 *
 * Two directions, both required:
 *
 *  1. Neither engine may ever read the OTHER engine's outputs, or the cohort layer's own outputs,
 *     before its own freeze -- so `predictionEngine/`, `parlayBuilder/`, the PE paper-trading
 *     orchestrator (`evaluation/paperTrading.ts`), and the Builder paper-trading orchestrator
 *     (`parlayPaperTrading/`) must NEVER import from `matchedCohort/` or reference
 *     matchedEngineCohortTable. If either engine could read the cohort table, it could (even
 *     accidentally) see the other engine's already-frozen prediction before making its own.
 *
 *  2. The cohort sync job itself may only READ each engine's own already-frozen/locked rows -- it
 *     must never import the engines' live scoring/discovery modules or call into their
 *     scoring/discovery functions, proving the cohort layer cannot influence either engine's
 *     prediction (only observe it after the fact).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../..");

function getAllTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...getAllTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

function loadNonCommentCode(absPath: string): string {
  const lines = readFileSync(absPath, "utf8").split("\n");
  return lines
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/**");
    })
    .map((line) => {
      const commentStart = line.indexOf("//");
      return commentStart >= 0 ? line.slice(0, commentStart) : line;
    })
    .join("\n");
}

describe("matched-cohort leakage firewall: engines never read the cohort layer", () => {
  const FORBIDDEN: Array<[RegExp, string]> = [
    [/from\s+['"].*matchedCohort['"]/, "import from matchedCohort/"],
    [/from\s+['"].*\/matchedCohort\//, "import from matchedCohort/"],
    [/matchedEngineCohortTable/, "direct reference to matchedEngineCohortTable"],
    [/matched_engine_cohort/, "direct reference to matched_engine_cohort raw table name"],
  ];

  const GUARDED_DIRS = [
    ["Prediction Engine core", join(SRC_DIR, "services/predictionEngine")],
    ["Parlay Builder core", join(SRC_DIR, "services/parlayBuilder")],
    ["Builder paper-trading orchestrator", join(SRC_DIR, "services/parlayPaperTrading")],
  ] as const;

  for (const [label, dir] of GUARDED_DIRS) {
    it(`${label} (${relative(SRC_DIR, dir)}/) never imports or references the matched-cohort layer`, () => {
      const violations: string[] = [];
      for (const file of getAllTsFiles(dir)) {
        const code = loadNonCommentCode(file);
        for (const [pattern, reason] of FORBIDDEN) {
          if (pattern.test(code)) violations.push(`${relative(SRC_DIR, file)}: ${reason}`);
        }
      }
      assert.deepStrictEqual(violations, [], `Found matched-cohort leakage in ${label}: ${violations.join(", ")}`);
    });
  }

  it("the PE paper-trading orchestrator (evaluation/paperTrading.ts) never imports or references the matched-cohort layer", () => {
    const file = join(SRC_DIR, "services/evaluation/paperTrading.ts");
    const code = loadNonCommentCode(file);
    const violations = FORBIDDEN.filter(([pattern]) => pattern.test(code)).map(([, reason]) => reason);
    assert.deepStrictEqual(violations, [], `Found matched-cohort leakage in paperTrading.ts: ${violations.join(", ")}`);
  });
});

describe("matched-cohort leakage firewall: the sync job never reads live engine internals", () => {
  const FORBIDDEN: Array<[RegExp, string]> = [
    [/from\s+['"].*\/predictionEngine\//, "import from predictionEngine/ (live scoring module)"],
    [/from\s+['"].*\/parlayBuilder\//, "import from parlayBuilder/ (live scoring module)"],
    [/computeBuilderScore/, "call into Builder's live scoring function"],
    [/acquireBuilderEvidence/, "call into Builder's live evidence acquisition"],
    [/runPaperTradingCycle/, "call into PE's live paper-trading cycle"],
    [/getUpcomingFixturesForPredictionEngine|getUpcomingFixturesForBuilder/, "call into either engine's live fixture discovery"],
  ];

  it("syncMatchedCohort.ts only reads already-frozen rows -- no live scoring/discovery imports or calls", () => {
    const file = join(__dirname, "syncMatchedCohort.ts");
    const code = loadNonCommentCode(file);
    const violations = FORBIDDEN.filter(([pattern]) => pattern.test(code)).map(([, reason]) => reason);
    assert.deepStrictEqual(violations, [], `Found live-engine coupling in syncMatchedCohort.ts: ${violations.join(", ")}`);
  });

  it("syncMatchedCohort.ts never writes to either engine's own tables (no insert/update/delete against evaluation_predictions or parlay_paper_trades)", () => {
    const file = join(__dirname, "syncMatchedCohort.ts");
    const code = loadNonCommentCode(file);
    assert.ok(!/\.update\(evaluationPredictionsTable\)/.test(code), "must never update evaluationPredictionsTable");
    assert.ok(!/\.delete\(evaluationPredictionsTable\)/.test(code), "must never delete from evaluationPredictionsTable");
    assert.ok(!/\.insert\(evaluationPredictionsTable\)/.test(code), "must never insert into evaluationPredictionsTable");
    assert.ok(!/\.update\(parlayPaperTradesTable\)/.test(code), "must never update parlayPaperTradesTable");
    assert.ok(!/\.delete\(parlayPaperTradesTable\)/.test(code), "must never delete from parlayPaperTradesTable");
    assert.ok(!/\.insert\(parlayPaperTradesTable\)/.test(code), "must never insert into parlayPaperTradesTable");
  });

  it("syncMatchedCohort.ts's only write target is matchedEngineCohortTable", () => {
    const file = join(__dirname, "syncMatchedCohort.ts");
    const code = loadNonCommentCode(file);
    const insertTargets = [...code.matchAll(/\.insert\((\w+)\)/g)].map((m) => m[1]);
    assert.deepStrictEqual(
      Array.from(new Set(insertTargets)),
      ["matchedEngineCohortTable"],
      "syncMatchedCohort.ts must only ever insert/upsert into matchedEngineCohortTable",
    );
  });
});
