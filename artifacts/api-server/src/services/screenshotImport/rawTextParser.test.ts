import assert from "node:assert/strict";
import test from "node:test";

import { parseOcrText } from "./rawTextParser";
import { parseRecognitionResponse } from "../tennisData/screenshotRecognition";

test("parses repeated six-field records without crossing matchup boundaries", () => {
  const parsed = parseOcrText(`Thiago Seyboth Wild vs Massimo Giunta
tournament: ATP Challenger Genoa
event_level: ATP Challenger
round: Round of 16
scheduled_date: 2026-09-10
surface: Clay
best_of: 3

Francesco Passaro vs Juan Pablo Varillas
tournament: ATP Challenger Genoa
event_level: ATP Challenger
round: Round of 16
scheduled_date: 2026-09-10
surface: Clay
best_of: 3`);

  assert.deepEqual(parsed, [
    {
      player1Name: "Thiago Seyboth Wild",
      player2Name: "Massimo Giunta",
      eventName: "ATP Challenger Genoa",
      level: "Challenger",
      round: "Round of 16",
      scheduledDate: "2026-09-10",
      surface: "Clay",
      matchFormat: "BestOf3",
    },
    {
      player1Name: "Francesco Passaro",
      player2Name: "Juan Pablo Varillas",
      eventName: "ATP Challenger Genoa",
      level: "Challenger",
      round: "Round of 16",
      scheduledDate: "2026-09-10",
      surface: "Clay",
      matchFormat: "BestOf3",
    },
  ]);
});

test("does not globally pair unrelated name-like lines across blocks", () => {
  const parsed = parseOcrText(`Daisuke Sumizawa

Tournament Header

Kosuke Ogura`);
  assert.deepEqual(parsed, []);
});

test("normalizes structured model aliases and numeric best_of", () => {
  const parsed = parseRecognitionResponse(JSON.stringify([{
    player1Name: "Eva Vedder",
    player2Name: "Maria Carle",
    tournament: "WTA 125K Antalya",
    event_level: "WTA 125K",
    round: "Round of 16",
    scheduled_date: "2026-09-10",
    surface: "Red clay",
    best_of: 3,
  }]));
  assert.deepEqual(parsed.matchups[0], {
    player1Name: "Eva Vedder",
    player2Name: "Maria Carle",
    eventName: "WTA 125K Antalya",
    level: "Other",
    round: "Round of 16",
    scheduledDate: "2026-09-10",
    surface: "Clay",
    matchFormat: "BestOf3",
  });
});