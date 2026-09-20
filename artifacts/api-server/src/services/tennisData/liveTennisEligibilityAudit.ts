import type { LiveTennisIdentityAudit } from "./liveTennisIdentityAudit.js";
import type { HistoricalFixture } from "./types.js";

export function matchEligibilityAudit(fixtures: HistoricalFixture[], identityAudit: LiveTennisIdentityAudit) {
  const identityByPlayer = new Map(identityAudit.entries.map((entry) => [`${entry.providerPlayerId}\u0000${entry.providerPlayerName}`, entry]));
  const counts = {
    totalMatches: fixtures.length,
    missingWinner: 0,
    unresolvedOrAmbiguousPlayerIdentity: 0,
    missingTournamentLevel: 0,
    missingSurface: 0,
    missingRound: 0,
    missingFormat: 0,
    missingFinalSetGames: 0,
    allRequiredFieldsPresent: 0,
  };
  for (const fixture of fixtures) {
    const p1 = identityByPlayer.get(`${fixture.player1Id}\u0000${fixture.player1Name}`);
    const p2 = identityByPlayer.get(`${fixture.player2Id}\u0000${fixture.player2Name}`);
    const missingIdentity = p1?.resolutionStatus !== "resolved" || p2?.resolutionStatus !== "resolved";
    const missingWinner = fixture.winnerId == null;
    const missingTournamentLevel = fixture.tournamentLevel == null;
    const missingSurface = fixture.surface == null;
    const missingRound = fixture.round == null;
    const missingFormat = fixture.matchFormat == null;
    const missingFinalSetGames = fixture.setGameMargins.length === 0;
    if (missingWinner) counts.missingWinner++;
    if (missingIdentity) counts.unresolvedOrAmbiguousPlayerIdentity++;
    if (missingTournamentLevel) counts.missingTournamentLevel++;
    if (missingSurface) counts.missingSurface++;
    if (missingRound) counts.missingRound++;
    if (missingFormat) counts.missingFormat++;
    if (missingFinalSetGames) counts.missingFinalSetGames++;
    if (!(missingWinner || missingIdentity || missingTournamentLevel || missingSurface || missingRound || missingFormat || missingFinalSetGames)) {
      counts.allRequiredFieldsPresent++;
    }
  }
  return { ...counts, reasonCountsAreNonExclusive: true };
}
