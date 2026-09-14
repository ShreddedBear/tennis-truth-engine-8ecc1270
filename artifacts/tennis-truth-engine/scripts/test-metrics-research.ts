import { resolveMatchIdentity, aiResearcher } from "../src/lib/audit-research.server";

async function main() {
  const match = {
    p1: "Arthur Fils",
    p2: "Thiago Agustin Tirante",
    hints: { tournament: "Cincinnati Open", scheduled_date: "2026-08-20" },
  };

  const identity = await resolveMatchIdentity(match);
  console.log("Identity:", JSON.stringify(identity, null, 2));

  const context = `Tournament: ${identity.tournament}, Level: ${identity.event_level}, Round: ${identity.round}, Surface: ${identity.surface}, Best of: ${identity.best_of}`;

  const p1Dossier = await aiResearcher.dossier({
    player: "Arthur Fils",
    opponent: "Thiago Agustin Tirante",
    context,
  });
  const p2Dossier = await aiResearcher.dossier({
    player: "Thiago Agustin Tirante",
    opponent: "Arthur Fils",
    context,
  });
  const fullDossier = `### Arthur Fils\n${p1Dossier}\n\n### Thiago Agustin Tirante\n${p2Dossier}`;

  console.log("\nDossier lengths:", p1Dossier.length, p2Dossier.length);
  console.log("Full dossier length:", fullDossier.length);

  const metrics = await aiResearcher.metrics({
    p1: "Arthur Fils",
    p2: "Thiago Agustin Tirante",
    context,
    dossier: fullDossier,
    metrics: [
      {
        code: "001",
        name: "Surface Strength",
        body: "Surface Elo, Elo Win Probability, Surface Sample Depth, Effective Weighted Sample, Surface Elo Trend, Peak vs Current Elo, Hard-Court Record, Last-52-Week Hard-Court Record",
      },
      {
        code: "002",
        name: "Serve Profile",
        body: "Hold %, Service Points Won %, First-Serve-In %, First-Serve Points Won %, Second-Serve Points Won %, Ace Rate, Double-Fault Rate, Break Points Saved %, Service Games Held, Serve-Out Reliability",
      },
    ],
  });

  console.log("\nMetrics result:", JSON.stringify(metrics, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
