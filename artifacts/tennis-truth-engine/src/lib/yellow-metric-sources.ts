export type YellowSectionSource = {
  section: number;
  name: string;
  sources: Array<{
    id: string;
    name: string;
    url: string;
    role: string;
    access: "PUBLIC" | "API_KEY" | "NONCOMMERCIAL_ONLY";
    earliest?: string;
  }>;
  reconstruct: boolean;
  universalCoverage: boolean;
  limitation: string | null;
};

/**
 * Source-of-truth registry for the remaining yellow Verification Metrics sections.
 *
 * IMPORTANT:
 * - This file does not turn a source URL into evidence by itself. A metric is DIRECT
 *   only after a source adapter returns the exact underlying observation for the exact
 *   player/match/time window.
 * - MCP is CC BY-NC-SA 4.0 and therefore must not be used in a commercial runtime.
 * - Missing historical coverage remains UNAVAILABLE; never fabricate a replacement.
 */
export const YELLOW_METRIC_SOURCES: YellowSectionSource[] = [
  {
    section: 13,
    name: "Availability",
    sources: [
      { id: "atp", name: "ATP Tour", url: "https://www.atptour.com/", role: "withdrawals, retirements, official player/event status", access: "PUBLIC" },
      { id: "wta", name: "WTA", url: "https://www.wtatennis.com/", role: "withdrawals, retirements, official player/event status", access: "PUBLIC" },
      { id: "itf", name: "ITF Tennis", url: "https://www.itftennis.com/en/tournament-calendar/results/", role: "ITF results/status context", access: "PUBLIC" },
    ],
    reconstruct: false,
    universalCoverage: false,
    limitation: "No comprehensive historical injury/availability API exists. Undocumented injuries and complete 2012-current availability history remain UNAVAILABLE.",
  },
  {
    section: 15,
    name: "Market Layer",
    sources: [
      { id: "odds", name: "The Odds API Historical Data", url: "https://the-odds-api.com/liveapi/guides/v4/#historical-odds", role: "historical sportsbook snapshots and market prices", access: "API_KEY", earliest: "2020-06" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "The Odds API historical archive does not cover 2012-2019. Those dates require a separate licensed historical odds source.",
  },
  {
    section: 16,
    name: "Point-by-Point & Score-State Metrics",
    sources: [
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "shot type/direction, serve direction, return depth, errors, rally and net data for charted matches", access: "NONCOMMERCIAL_ONLY" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "MCP covers only charted matches and is CC BY-NC-SA 4.0. Universal shot-level history is impossible from this source.",
  },
  {
    section: 19,
    name: "Market Calibration",
    sources: [
      { id: "odds", name: "The Odds API Historical Data", url: "https://the-odds-api.com/liveapi/guides/v4/#historical-odds", role: "historical market snapshots for calibration", access: "API_KEY", earliest: "2020-06" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Complete 2012-current market calibration cannot be produced from the current Odds API archive.",
  },
  {
    section: 23,
    name: "Matchup-Adjusted Metrics",
    sources: [
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "tactical matchup inputs where charted", access: "NONCOMMERCIAL_ONLY" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Tactical residuals can be reconstructed only when compatible historical/PBP inputs exist; MCP is not universal.",
  },
  {
    section: 24,
    name: "Hidden Performance Quality",
    sources: [
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "deeper shot/rally performance components for charted matches", access: "NONCOMMERCIAL_ONLY" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Universal historical shot-level coverage does not exist.",
  },
  {
    section: 28,
    name: "Scheduling Context",
    sources: [
      { id: "atp_archive", name: "ATP Results Archive", url: "https://www.atptour.com/en/scores/results-archive", role: "ATP event dates/results", access: "PUBLIC" },
      { id: "wta", name: "WTA", url: "https://www.wtatennis.com/", role: "WTA event/results context", access: "PUBLIC" },
      { id: "itf", name: "ITF Tennis", url: "https://www.itftennis.com/en/tournament-calendar/results/", role: "ITF event/results context", access: "PUBLIC" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Exact historical start/finish times, practice access and every late schedule change are not universally published.",
  },
  {
    section: 30,
    name: "Tournament-Specific Strength",
    sources: [
      { id: "open_meteo", name: "Open-Meteo Historical Weather", url: "https://open-meteo.com/en/docs/historical-weather-api", role: "historical temperature, humidity, wind and weather", access: "PUBLIC" },
      { id: "atp_archive", name: "ATP Results Archive", url: "https://www.atptour.com/en/scores/results-archive", role: "event history", access: "PUBLIC" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Exact historical court-speed measurements and ball measurements are not comprehensively public for every event.",
  },
  {
    section: 36,
    name: "Loss Autopsy Metrics",
    sources: [
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "shot/rally/serve/return/error evidence for charted losses", access: "NONCOMMERCIAL_ONLY" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Physical/injury explanations remain incomplete unless independently documented.",
  },
  {
    section: 40,
    name: "Hidden Decline Detector",
    sources: [
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "deeper serve/return/rally behavior where charted", access: "NONCOMMERCIAL_ONLY" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Comprehensive serve-speed, movement and injury history is not available for every player/match.",
  },
  {
    section: 42,
    name: "Opponent Win Pathways",
    sources: [
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "tactical pathway inputs where charted", access: "NONCOMMERCIAL_ONLY" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "There is no source that directly publishes opponent win pathways; they must be transparently reconstructed from underlying evidence.",
  },
  {
    section: 44,
    name: "Opponent Upset Compatibility",
    sources: [
      { id: "atp_archive", name: "ATP Results Archive", url: "https://www.atptour.com/en/scores/results-archive", role: "historical ATP results", access: "PUBLIC" },
      { id: "odds", name: "The Odds API Historical Data", url: "https://the-odds-api.com/liveapi/guides/v4/#historical-odds", role: "market-favorite/underdog context where covered", access: "API_KEY", earliest: "2020-06" },
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "style/tactical similarity where charted", access: "NONCOMMERCIAL_ONLY" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "No dedicated upset-compatibility feed exists; 2012-2019 historical market context is not covered by the current Odds API source.",
  },
  {
    section: 60,
    name: "Interaction / Matchup Residuals",
    sources: [
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "tactical variables where charted", access: "NONCOMMERCIAL_ONLY" },
      { id: "open_meteo", name: "Open-Meteo Historical Weather", url: "https://open-meteo.com/en/docs/historical-weather-api", role: "historical environmental inputs", access: "PUBLIC" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Interaction residuals are calculated outputs, not directly sourced metrics; missing tactical inputs must remain PARTIAL/UNAVAILABLE.",
  },
  {
    section: 62,
    name: "Motivation / Stakes",
    sources: [
      { id: "atp", name: "ATP Tour", url: "https://www.atptour.com/", role: "rankings, points and tournament context", access: "PUBLIC" },
      { id: "wta", name: "WTA", url: "https://www.wtatennis.com/", role: "rankings, points and tournament context", access: "PUBLIC" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Ranking/entry stakes can be reconstructed; subjective psychological motivation cannot be objectively sourced for every match.",
  },
  {
    section: 71,
    name: "Session / Environment",
    sources: [
      { id: "open_meteo", name: "Open-Meteo Historical Weather", url: "https://open-meteo.com/en/docs/historical-weather-api", role: "historical weather", access: "PUBLIC" },
      { id: "atp_archive", name: "ATP Results Archive", url: "https://www.atptour.com/en/scores/results-archive", role: "event/schedule context", access: "PUBLIC" },
      { id: "wta", name: "WTA", url: "https://www.wtatennis.com/", role: "WTA event/schedule context", access: "PUBLIC" },
      { id: "itf", name: "ITF Tennis", url: "https://www.itftennis.com/en/tournament-calendar/results/", role: "ITF event/schedule context", access: "PUBLIC" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Historical roof status and exact court conditions are not comprehensive.",
  },
  {
    section: 72,
    name: "Matchup Nuance",
    sources: [
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "shot type/direction, serve direction, return depth and tactical tendencies", access: "NONCOMMERCIAL_ONLY" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Physical attributes such as wingspan and undocumented stroke-mechanics traits are not comprehensively available.",
  },
  {
    section: 75,
    name: "Match Format / Rules Context",
    sources: [
      { id: "atp", name: "ATP Tour", url: "https://www.atptour.com/", role: "ATP format/rules/event context", access: "PUBLIC" },
      { id: "wta", name: "WTA", url: "https://www.wtatennis.com/", role: "WTA format/rules/event context", access: "PUBLIC" },
      { id: "itf", name: "ITF Tennis", url: "https://www.itftennis.com/", role: "ITF format/rules/event context", access: "PUBLIC" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Basic Bo3/Bo5 and format are obtainable, but every historical event-specific rules variation is not guaranteed.",
  },
  {
    section: 76,
    name: "Scheduling Micro-Context",
    sources: [
      { id: "atp_archive", name: "ATP Results Archive", url: "https://www.atptour.com/en/scores/results-archive", role: "ATP event/results schedule context", access: "PUBLIC" },
      { id: "wta", name: "WTA", url: "https://www.wtatennis.com/", role: "WTA schedule context", access: "PUBLIC" },
      { id: "itf", name: "ITF Tennis", url: "https://www.itftennis.com/en/tournament-calendar/results/", role: "ITF schedule/results context", access: "PUBLIC" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Practice-court access, unpublished last-minute changes and exact historical recovery windows can be unavailable.",
  },
  {
    section: 79,
    name: "Additional Differentiating Metrics",
    sources: [
      { id: "mcp", name: "Match Charting Project", url: "https://github.com/JeffSackmann/tennis_MatchChartingProject", role: "tactical submetrics where charted", access: "NONCOMMERCIAL_ONLY" },
      { id: "open_meteo", name: "Open-Meteo Historical Weather", url: "https://open-meteo.com/en/docs/historical-weather-api", role: "environmental submetrics", access: "PUBLIC" },
      { id: "atp", name: "ATP Tour", url: "https://www.atptour.com/", role: "ATP event/results context", access: "PUBLIC" },
      { id: "wta", name: "WTA", url: "https://www.wtatennis.com/", role: "WTA event/results context", access: "PUBLIC" },
      { id: "itf", name: "ITF Tennis", url: "https://www.itftennis.com/", role: "ITF event/results context", access: "PUBLIC" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Undocumented medical, coaching and physical information remains UNAVAILABLE.",
  },
  {
    section: 81,
    name: "Further Differentiating Metrics",
    sources: [
      { id: "atp", name: "ATP Tour", url: "https://www.atptour.com/", role: "documented event context", access: "PUBLIC" },
      { id: "wta", name: "WTA", url: "https://www.wtatennis.com/", role: "documented event context", access: "PUBLIC" },
      { id: "itf", name: "ITF Tennis", url: "https://www.itftennis.com/", role: "documented event context", access: "PUBLIC" },
    ],
    reconstruct: true,
    universalCoverage: false,
    limitation: "Backstage conflicts, ceremony effects and similar undocumented context do not have a complete structured historical dataset.",
  },
];

export function yellowSection(section: number) {
  return YELLOW_METRIC_SOURCES.find((row) => row.section === section) ?? null;
}

export function sourceById(id: string) {
  return YELLOW_METRIC_SOURCES.flatMap((row) => row.sources).find((source) => source.id === id) ?? null;
}
