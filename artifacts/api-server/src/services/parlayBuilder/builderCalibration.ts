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
  modelId?: number;
  modelVersion: string;
  method: "isotonic";
  sampleSize: number;
  fingerprint: string;
  provenance: string;
  eligible: boolean;
  mapping: Array<{ score: number; probability: number }>;
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
    mapping: [],
    mapProbability: (rawScore) => Math.max(0, Math.min(100, rawScore)),
  };
}

async function persistBuilderCalibrationModel(model: BuilderCalibrationModel): Promise<number | undefined> {
  if (!model.eligible) return undefined;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: number }>(
      `SELECT id FROM builder_calibration_models
        WHERE model_version = $1 AND fingerprint = $2
        FOR UPDATE`,
      [model.modelVersion, model.fingerprint],
    );
    let id: number;
    if (existing.rows[0]) {
      id = existing.rows[0].id;
      await client.query(
        `UPDATE builder_calibration_models
            SET active = true, fitted_at = now(), sample_count = $3, mapping = $4::jsonb,
                provenance = $5
          WHERE id = $1 AND fingerprint = $2`,
        [id, model.fingerprint, model.sampleSize, JSON.stringify(model.mapping), model.provenance],
      );
    } else {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO builder_calibration_models
          (model_version, method, mapping, sample_count, fingerprint, active, provenance)
         VALUES ($1, $2, $3::jsonb, $4, $5, true, $6)
         RETURNING id`,
        [model.modelVersion, model.method, JSON.stringify(model.mapping), model.sampleSize, model.fingerprint, model.provenance],
      );
      id = inserted.rows[0]!.id;
    }
    await client.query(
      `UPDATE builder_calibration_models SET active = false WHERE id <> $1 AND model_version = $2`,
      [id, model.modelVersion],
    );
    await client.query("COMMIT");
    return id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
    provenance: "parlay_leg_outcomes.resolved actual_winner_id; Builder-owned isotonic fit; registry persisted when available",
    eligible: true,
    mapping: blocks.map((block) => ({ score: block.x, probability: Math.round(block.y * 1000) / 10 })),
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
  if (model.eligible) {
    try {
      model.modelId = await persistBuilderCalibrationModel(model);
    } catch {
      // Calibration remains usable in-memory if the optional registry is unavailable.
    }
  }
  cached = { expiresAt: Date.now() + CACHE_TTL_MS, model };
  return model;
}

export function clearBuilderCalibrationCache(): void {
  cached = null;
}