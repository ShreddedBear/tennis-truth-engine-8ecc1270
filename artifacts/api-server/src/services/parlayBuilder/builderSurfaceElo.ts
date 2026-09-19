import type { MatchRecord, Surface } from "../tennisData/types.js";

export interface BuilderSurfaceEloResult {
  player1SurfaceElo: number;
  player2SurfaceElo: number;
  eloDifference: number;
  eloWinProbabilityPlayer1: number;
  reliability: number;
  sampleSizePlayer1: number;
  sampleSizePlayer2: number;
  defaulted: boolean;
  warnings: string[];
}

function rating(matches: MatchRecord[], surface: Surface): { elo: number; sample: number } {
  let elo = 1500;
  let sample = 0;
  for (const match of [...matches].sort((a, b) => a.date.localeCompare(b.date))) {
    if (match.surface !== surface) continue;
    sample++;
    const expected = 1 / (1 + 10 ** ((elo - (match.opponentRank ? 1500 + (100 - match.opponentRank) * 2 : 1500)) / 400));
    elo += 32 * ((match.result === "W" ? 1 : 0) - expected);
  }
  return { elo, sample };
}

export function computeBuilderSurfaceElo(
  player1Matches: MatchRecord[],
  player2Matches: MatchRecord[],
  surface: Surface,
): BuilderSurfaceEloResult {
  const p1 = rating(player1Matches, surface);
  const p2 = rating(player2Matches, surface);
  const difference = Math.round(p1.elo) - Math.round(p2.elo);
  const raw = 100 / (1 + 10 ** (-difference / 400));
  const reliability = Math.min(100, Math.max(0, Math.min(p1.sample, p2.sample) * 12));
  const probability = 50 + (raw - 50) * (reliability / 100);
  return {
    player1SurfaceElo: Math.round(p1.elo),
    player2SurfaceElo: Math.round(p2.elo),
    eloDifference: difference,
    eloWinProbabilityPlayer1: Math.round(probability * 10) / 10,
    reliability: Math.round(reliability),
    sampleSizePlayer1: p1.sample,
    sampleSizePlayer2: p2.sample,
    defaulted: p1.sample === 0 || p2.sample === 0,
    warnings: Math.min(p1.sample, p2.sample) < 5 ? ["Surface sample is limited."] : [],
  };
}