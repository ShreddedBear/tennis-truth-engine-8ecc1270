import { resolveMatchIdentity, aiResearcher } from "../src/lib/audit-research.server";
import fs from "fs";

async function main() {
  const match = {
    p1: "Arthur Fils",
    p2: "Thiago Agustin Tirante",
    hints: { tournament: "Cincinnati Open", scheduled_date: "2026-08-20" },
  };

  const identity = await resolveMatchIdentity(match);
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

  const rules = JSON.parse(fs.readFileSync("/tmp/metric-rules.json", "utf8"));
  const batch = rules.slice(0, 3);

  const metrics = await aiResearcher.metrics({
    p1: "Arthur Fils",
    p2: "Thiago Agustin Tirante",
    context,
    dossier: fullDossier,
    metrics: batch.map((r: { rule_code: string; rule_name: string; body: string }) => ({
      code: r.rule_code,
      name: r.rule_name,
      body: r.body.slice(0, 500),
    })),
  });

  const direct = metrics.filter((m) => m.p1_treatment === "DIRECT" || m.p2_treatment === "DIRECT").length;
  const total = metrics.length;
  console.log(`Direct: ${direct}/${total}`);
  console.log(JSON.stringify(metrics.slice(0, 3), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
