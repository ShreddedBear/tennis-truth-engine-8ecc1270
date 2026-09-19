import { pool } from "@workspace/db";

export const BUILDER_CALIBRATION_VERSION = "builder-isotonic-v1";
export const BUILDER_CALIBRATION_MIN_SAMPLE = 50;
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface BuilderCalibrationRow {
  validationScore: number;
  selectedPlayerId: string;
  actualWinnerId: string;
}

export interface BuilderCalibrationModel {
  modelVersion: string;
  method: "isotonic";
  sampleSize: number;
  fingerprint: string;
  provenance: string;
  eligible: boolean;
  mapProbability: (rawScore: number) => number;
}

interface Block {
  x: number;
  y: number;
  weight: number;
}

function fingerprint(rows: BuilderCalibrationRow[]): string {
  let hash = 2166136261;
  for (const row of rows) {
    const value = `${row.validationScore}|${row.selectedPlayerId}|${row.actualWinnerId};`;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function fallbackModel(rows: BuilderCalibrationRow[], reason: string): BuilderCalibrationModel {
  return {
    modelVersion: BUILDER_CALIBRATION_VERSION,
    method: "isotonic",
    sampleSize: rows.length,
    fingerprint: fingerprint(rows),
    provenance: `parlay_leg_outcomes.resolved; ${reason}; in-memory only (durable provenance deferred to Stage 6)`,
    eligible: false,
    mapProbability: (rawScore) => Math.max(0, Math.min(100, rawScore)),
  };
}

/** Fit weighted PAVA blocks; equal-score observations are grouped before fitting. */
export function fitBuilderCalibration(rows: BuilderCalibrationRow[], minSample = BUILDER_CALIBRATION_MIN_SAMPLE): BuilderCalibrationModel {
  if (rows.length < minSample) return fallbackModel(rows, `minimum sample ${minSample} not met`);

  const grouped = new Map<number, { wins: number; total: number }>();
  for (const row of rows) {
    if (!Number.isFinite(row.validationScore)) continue;
    const score = Math.max(0, Math.min(100, row.validationScore));
    const group = grouped.get(score) ?? { wins: 0, total: 0 };
    group.total++;
    if (row.actualWinnerId === row.selectedPlayerId) group.wins++;
    grouped.set(score, group);
  }
  const blocks: Block[] = [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([x, value]) => ({ x, y: value.wins / value.total, weight: value.total }));
  for (let i = 0; i < blocks.length; i++) {
    while (i > 0 && blocks[i - 1]!.y > blocks[i]!.y) {
      const left = blocks[i - 1]!;
      const right = blocks[i]!;
      const weight = left.weight + right.weight;
      left.y = (left.y * left.weight + right.y * right.weight) / weight;
      left.weight = weight;
      blocks.splice(i, 1);
      i--;
    }
  }
  const mapProbability = (rawScore: number): number => {
    const x = Math.max(0, Math.min(100, rawScore));
    if (blocks.length === 0) return x;
    if (x <= blocks[0]!.x) return Math.round(blocks[0]!.y * 1000) / 10;
    for (let i = 1; i < blocks.length; i++) {
      if (x <= blocks[i]!.x) return Math.round(blocks[i - 1]!.y * 1000) / 10;
    }
    return Math.round(blocks[blocks.length - 1]!.y * 1000) / 10;
  };
  return {
    modelVersion: BUILDER_CALIBRATION_VERSION,
    method: "isotonic",
    sampleSize: rows.length,
    fingerprint: fingerprint(rows),
    provenance: "parlay_leg_outcomes.resolved actual_winner_id; in-memory fit (durable provenance deferred to Stage 6)",
    eligible: true,
    mapProbability,
  };
}

let cached: { expiresAt: number; model: BuilderCalibrationModel } | null = null;

/** Read-only Builder outcome source. This never relabels or writes historical rows. */
export async function getActiveBuilderCalibration(): Promise<BuilderCalibrationModel> {
  if (cached && cached.expiresAt > Date.now()) return cached.model;
  const result = await pool.query<{ validation_score: number; selected_player_id: string; actual_winner_id: string }>(
    `SELECT validation_score, selected_player_id, actual_winner_id
       FROM parlay_leg_outcomes
      WHERE actual_winner_id IS NOT NULL
      ORDER BY created_at ASC`,
  );
  const model = fitBuilderCalibration(result.rows.map((row) => ({
    validationScore: Number(row.validation_score),
    selectedPlayerId: row.selected_player_id,
    actualWinnerId: row.actual_winner_id,
  })));
  cached = { expiresAt: Date.now() + CACHE_TTL_MS, model };
  return model;
}

export function clearBuilderCalibrationCache(): void {
  cached = null;
}