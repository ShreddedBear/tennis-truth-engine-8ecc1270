import type { HistoricalMatchContextRow } from "../historicalData/matchRecordReconstruction";

export interface WalkForwardSelectionOptions {
  matchIds?: readonly number[] | null;
  startDate?: Date | null;
  endDate?: Date | null;
  alreadyScoredIds?: ReadonlySet<number>;
}

/** Selects score targets without changing the chronological order of the corpus. */
export function selectWalkForwardTargets(
  rows: readonly HistoricalMatchContextRow[],
  options: WalkForwardSelectionOptions,
): HistoricalMatchContextRow[] {
  const ids = options.matchIds && options.matchIds.length > 0 ? new Set(options.matchIds) : null;
  return rows
    .filter((row) =>
      !row.cancelled &&
      !options.alreadyScoredIds?.has(row.id) &&
      (ids === null || ids.has(row.id)) &&
      (!options.startDate || row.scheduledStartAt >= options.startDate) &&
      (!options.endDate || row.scheduledStartAt <= options.endDate),
    )
    .sort((a, b) =>
      a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime() || a.id - b.id,
    );
}

/** Context rows are still filtered per target cutoff by reconstruction. */
export function contextRowsBeforeCutoff(
  rows: readonly HistoricalMatchContextRow[],
  cutoffAt: Date,
): HistoricalMatchContextRow[] {
  return rows.filter((row) => row.scheduledStartAt < cutoffAt);
}

export function latestTargetCutoff(
  rows: readonly HistoricalMatchContextRow[],
): Date | null {
  if (rows.length === 0) return null;
  return rows.reduce(
    (latest, row) => row.cutoffAt > latest ? row.cutoffAt : latest,
    rows[0]!.cutoffAt,
  );
}