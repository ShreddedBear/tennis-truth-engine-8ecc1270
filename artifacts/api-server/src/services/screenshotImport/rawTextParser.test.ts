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

test("extracts multiple OCR-damaged metadata labels from one line", () => {
  const [parsed] = parseOcrText(`MATCHUP 15
Daisuke Sumizawa vs Kosuke Ogura
ournament: AlP Challenger Guangzhou Event Lavel: Challengar Round: Qualifying Round 1
Scheduled Date: 2026-09-13 Surface: Hard Best Of: 3`);
  assert.deepEqual(parsed, {
    player1Name: "Daisuke Sumizawa",
    player2Name: "Kosuke Ogura",
    eventName: "AlP Challenger Guangzhou",
    level: "Other",
    round: "Qualifying Round 1",
    scheduledDate: "2026-09-13",
    surface: "Hard",
    matchFormat: "BestOf3",
  });
});

test("fills a missing event only when both adjacent records agree", () => {
  const parsed = parseOcrText(`A One vs B One
Tournament: ATP Challenger Biella

C Two vs D Two
Scheduled Date: 2026-09-13 Surface: Clay Best Of: 3

E Three vs F Three
lournament ATP Challenger Biella`);
  assert.equal(parsed[1]?.eventName, "ATP Challenger Biella");

  const distinct = parseOcrText(`A One vs B One
Tournament: ATP Challenger Biella

C Two vs D Two
Scheduled Date: 2026-09-13

E Three vs F Three
Tournament: ATP Challenger Rennes`);
  assert.equal(distinct[1]?.eventName, null);
});

test("recovers the omitted Biella event from the two agreeing OCR-damaged neighbours", () => {
  const parsed = parseOcrText(`MATCHUP 1
Lorenzo Beraldo vs Dimitris Sakellaridis
ournament: All Challenger Bells tvmtlevel: Chilleneer Round: Qualifying Round 1
Scheduled Date: 2026-09-13 Surface: Clay Best Of: 3
Adrian Oetzbach vs Pierluigi Basile
Scheduled Date: 2026-09-13 Surface: Clay Best Of: 3
MATCHUP 3
Matthew William Donald vs Giovanni Oradini
ournament: ATP Challenger Biells Event Level: Challenger Round: Qualifying Round 1`);
  assert.equal(parsed[1]?.eventName, "All Challenger Bells");
  assert.equal(parsed[1]?.player1Name, "Adrian Oetzbach");
  assert.equal(parsed[1]?.player2Name, "Pierluigi Basile");
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