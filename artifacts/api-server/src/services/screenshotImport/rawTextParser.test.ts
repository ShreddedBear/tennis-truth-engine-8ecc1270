import test from "node:test";
import assert from "node:assert/strict";
import { parseOcrText } from "./rawTextParser";

test("does not turn an empty-fixtures app screen into fake player matchups", () => {
  const appScreenText = `11:054
A
•all
414'
-3cyrqixfzm32g.reed.replit.dev
RUN MODEL
→ Sign in to save predictions
Upcoming
Fixtures
• LIVE
DATA
G REFRESH
Fixtures Diagnostics
Provider received: 0
Filtered: 0
Timezone:
America/New_York
Retained: 0
Dismissed: 0
Last refresh: 11:05:45
PM
NO UPCOMING FIXTURES FOUND
88
HOME
RUN MODEL
HISTORY
MORE`;

  assert.deepEqual(parseOcrText(appScreenText), []);
});

test("still pairs ordinary full names, Unicode names, and surname-only rows", () => {
  assert.deepEqual(
    parseOcrText("Carlos Alcaraz\nJannik Sinner\nBarbora Krejčíková\nIga Świątek\nSabalenka\nPegula"),
    [
      { player1Name: "Carlos Alcaraz", player2Name: "Jannik Sinner", eventName: null },
      { player1Name: "Barbora Krejčíková", player2Name: "Iga Świątek", eventName: null },
      { player1Name: "Sabalenka", player2Name: "Pegula", eventName: null },
    ],
  );
});

test("inline matchup parsing rejects URLs and app labels on either side", () => {
  assert.deepEqual(parseOcrText("Carlos Alcaraz vs Jannik Sinner"), [
    { player1Name: "Carlos Alcaraz", player2Name: "Jannik Sinner", eventName: null },
  ]);
  assert.deepEqual(parseOcrText("RUN MODEL - HISTORY\napp.replit.dev vs REFRESH"), []);
});