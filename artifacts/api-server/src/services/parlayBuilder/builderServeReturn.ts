import type { MatchRecord, Surface } from "../tennisData/types.js";

export interface BuilderServeReturnResult {
  player1ServeRating: number;
  player2ServeRating: number;
  player1ReturnRating: number;
  player2ReturnRating: number;
  defaulted: boolean;
  reliability: number;
  warnings: string[];
}

function marginRating(matches: MatchRecord[], surface: Surface): { serve: number; ret: number; sample: number } {
  let serve = 50;
  let ret = 50;
  let sample = 0;
  for (const match of matches) {
    if (match.surface !== surface || match.setGameMargins.length === 0) continue;
    const margin = match.setGameMargins.reduce((sum, set) => sum + set.playerGames - set.opponentGames, 0);
    serve += Math.max(-5, Math.min(5, margin));
    ret += Math.max(-5, Math.min(5, margin / 2));
    sample++;
  }
  return { serve, ret, sample };
}

export function computeBuilderServeReturn(
  player1Matches: MatchRecord[],
  player2Matches: MatchRecord[],
  surface: Surface,
): BuilderServeReturnResult {
  const p1 = marginRating(player1Matches, surface);
  const p2 = marginRating(player2Matches, surface);
  const sample = Math.min(p1.sample, p2.sample);
  return {
    player1ServeRating: Math.round(p1.serve),
    player2ServeRating: Math.round(p2.serve),
    player1ReturnRating: Math.round(p1.ret),
    player2ReturnRating: Math.round(p2.ret),
    defaulted: sample === 0,
    reliability: Math.min(100, sample * 20),
    warnings: sample < 5 ? ["Serve/return sample is limited."] : [],
  };
}