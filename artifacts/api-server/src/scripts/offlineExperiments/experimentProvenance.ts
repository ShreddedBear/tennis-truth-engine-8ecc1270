/**
 * Experiment provenance contract — shared infrastructure for offline audit experiments.
 *
 * Every offline experiment script (exp1..exp7 in this directory) must emit ONE of these
 * records alongside its output table, whether the run produced real numbers or was BLOCKED
 * for lack of data. A BLOCKED run still emits a provenance record with N_total/N_eligible
 * reflecting reality (e.g. 0/0) and an exclusionReasons breakdown explaining why — provenance
 * is never skipped just because there was nothing to compute.
 *
 * This lets anyone reading an experiment's output answer, without re-running anything:
 *   - which exact commit produced this output (codeCommit)
 *   - which exact production formula version was used (formulaVersion — so a stale
 *     productionFormulaMirror.ts drift problem is visible from the output alone)
 *   - which data this ran against, and whether two runs used identical input (datasetHash)
 *   - how many rows were considered, how many were admitted, and why the rest were excluded
 *   - what temporal-cutoff rule was actually enforced
 *
 * Nothing in this file computes any experiment result — it only describes provenance.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export interface ExperimentProvenance {
  /** Stable experiment name + a version number the author controls, e.g. "risk-floor-on-off@v1". */
  experimentId: string;
  /** git SHA of the worktree HEAD when the script ran. Never hardcoded — read live via git. */
  codeCommit: string;
  /**
   * Exactly which production function/version this experiment's scoring came from, e.g.
   * "toDecision/closenessRiskFloor via productionFormulaMirror.ts pinned against
   * builderScoringService.ts@<sha> (see productionFormulaMirror.ts header)".
   */
  formulaVersion: string;
  /** Human label for what was loaded, e.g. a file path or "parlay_leg_outcomes (live DB query)". */
  datasetIdentifier: string;
  /** SHA-256 hex digest of the serialized input rows, so two runs can be proven identical or not. */
  datasetHash: string;
  /** Min/max of whatever date field defines the corpus. Both null when there were 0 rows. */
  dateRange: { min: string | null; max: string | null };
  /** The temporal-cutoff rule actually enforced, stated precisely, e.g. "oddsFetchedAt <= cutoffAt". */
  predictionCutoffRule: string;
  nTotal: number;
  nEligible: number;
  nExcluded: number;
  /** Breakdown by reason, not just a count. Keys are exact exclusion-reason strings; values are counts. */
  exclusionReasons: Record<string, number>;
  /** Plain description of how leakage was checked for this specific run. */
  temporalValidationMethod: string;
  /** ISO timestamp of when this provenance record was generated. */
  generatedAt: string;
}

/**
 * Reads the current worktree HEAD commit SHA. Never hardcoded, never cached across calls —
 * each script calls this at runtime so the recorded commit always reflects what actually ran.
 * Fails loudly rather than silently substituting a placeholder: a provenance record with a
 * fake commit SHA would be worse than no record, since it would look verifiable and not be.
 */
export function readCurrentCommit(cwd: string = process.cwd()): string {
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) {
      throw new Error(`git rev-parse HEAD returned something that isn't a 40-char SHA: "${sha}"`);
    }
    return sha;
  } catch (err) {
    throw new Error(
      `experimentProvenance.readCurrentCommit: could not determine the worktree's git HEAD commit ` +
        `(required for provenance.codeCommit — refusing to substitute a placeholder). ` +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * SHA-256 of the serialized input rows. Rows are sorted-key JSON.stringify'd per-row (not the
 * whole array naively stringified) so the hash is stable across property-insertion-order
 * differences between two otherwise-identical row sets, then joined and hashed.
 */
export function hashDataset(rows: ReadonlyArray<Record<string, unknown>>): string {
  const hash = createHash("sha256");
  for (const row of rows) {
    hash.update(stableStringify(row));
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (value instanceof Date) return `"__date__${value.toISOString()}"`;
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** Computes {min,max} ISO date strings for a field across rows; both null when rows is empty. */
export function computeDateRange<T>(
  rows: ReadonlyArray<T>,
  getDate: (row: T) => Date | string | null | undefined,
): { min: string | null; max: string | null } {
  let min: Date | null = null;
  let max: Date | null = null;
  for (const row of rows) {
    const raw = getDate(row);
    if (raw == null) continue;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (min === null || d < min) min = d;
    if (max === null || d > max) max = d;
  }
  return { min: min ? min.toISOString() : null, max: max ? max.toISOString() : null };
}

export interface BuildProvenanceArgs<T> {
  experimentId: string;
  formulaVersion: string;
  datasetIdentifier: string;
  rows: ReadonlyArray<T>;
  /** Extracts the date used for dateRange (e.g. a row's cutoffAt/createdAt). */
  getDate: (row: T) => Date | string | null | undefined;
  predictionCutoffRule: string;
  nEligible: number;
  /** Reason string -> count. Must sum to nTotal - nEligible; asserted below. */
  exclusionReasons: Record<string, number>;
  temporalValidationMethod: string;
  /** Working directory to read git HEAD from. Defaults to process.cwd(). */
  cwd?: string;
}

/**
 * Builds one ExperimentProvenance record. Fails loudly (throws) if the exclusion-reason
 * breakdown doesn't reconcile with nTotal/nEligible — a provenance record whose own numbers
 * don't add up is worse than none, since a reader would trust it.
 */
export function buildProvenance<T extends Record<string, unknown>>(args: BuildProvenanceArgs<T>): ExperimentProvenance {
  const nTotal = args.rows.length;
  const nExcluded = nTotal - args.nEligible;
  const reasonSum = Object.values(args.exclusionReasons).reduce((s, v) => s + v, 0);
  if (reasonSum !== nExcluded) {
    throw new Error(
      `buildProvenance(${args.experimentId}): exclusionReasons sums to ${reasonSum} but nExcluded is ` +
        `${nExcluded} (nTotal=${nTotal}, nEligible=${args.nEligible}). Every excluded row must be ` +
        `attributed to exactly one reason — fix the caller's bookkeeping rather than passing ` +
        `mismatched numbers.`,
    );
  }
  if (args.nEligible < 0 || args.nEligible > nTotal) {
    throw new Error(
      `buildProvenance(${args.experimentId}): nEligible=${args.nEligible} is out of range for nTotal=${nTotal}.`,
    );
  }
  return {
    experimentId: args.experimentId,
    codeCommit: readCurrentCommit(args.cwd),
    formulaVersion: args.formulaVersion,
    datasetIdentifier: args.datasetIdentifier,
    datasetHash: hashDataset(args.rows as ReadonlyArray<Record<string, unknown>>),
    dateRange: computeDateRange(args.rows, args.getDate),
    predictionCutoffRule: args.predictionCutoffRule,
    nTotal,
    nEligible: args.nEligible,
    nExcluded,
    exclusionReasons: args.exclusionReasons,
    temporalValidationMethod: args.temporalValidationMethod,
    generatedAt: new Date().toISOString(),
  };
}
