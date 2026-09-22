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

test("parses labeled OCR schedule blocks and preserves repeated matchup metadata", () => {
  const text = `ATP CHALLENGER BUENOS AIRES II — SET 2
OCR INPUT — Tournament / Surface / Level / Best of / Date / Time / Player 1 / Player 2
MATCH 1
Tournament: ATP Challenger Buenos Aires II
Surface: Clay Level: Challenger 75 Best of: 3
Date: 2026-09-22 Time: 10:10 AM
Player 1: Gonzalo Bueno
Player 2: Franco Roncadelli
MATCH 2
Tournament: ATP Challenger Buenos Aires II
Surface: Clay
Level: Challenger 75
Date: 2026-09-22
Time: 11:20 AM
Player 1: Pedro Martinez
Player 2: Eduardo Ribeiro
Best of: 3`;

  assert.deepEqual(parseOcrText(text), [
    {
      player1Name: "Gonzalo Bueno",
      player2Name: "Franco Roncadelli",
      eventName: "ATP Challenger Buenos Aires II",
      surface: "Clay",
      eventLevel: "Challenger 75",
      bestOf: "3",
      date: "2026-09-22",
      time: "10:10 AM",
    },
    {
      player1Name: "Pedro Martinez",
      player2Name: "Eduardo Ribeiro",
      eventName: "ATP Challenger Buenos Aires II",
      surface: "Clay",
      eventLevel: "Challenger 75",
      bestOf: "3",
      date: "2026-09-22",
      time: "11:20 AM",
    },
  ]);
});

test("does not emit a structured block that contains metadata but no player", () => {
  assert.deepEqual(
    parseOcrText("MATCH 1\nTournament: ATP Challenger San Diego 2\nSurface: Hard\nDate: 2026-09-22"),
    [],
  );
});