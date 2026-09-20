import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalScreenshotIdentityIndex,
  resolveCanonicalScreenshotName,
} from "./canonicalScreenshotIdentity";
import { countConfidentProviderCandidates } from "./screenshotMatchupResolver";
import type { PlayerSummary } from "./types";

const players = [
  { id: "max", displayName: "Max Schoenhaus", normalizedName: "max schoenhaus", tour: "ATP" },
  { id: "matteo", displayName: "Matteo Martineau", normalizedName: "matteo martineau", tour: "ATP" },
  { id: "francesco", displayName: "Francesco Maestrelli", normalizedName: "francesco maestrelli", tour: "ATP" },
  { id: "arthur", displayName: "Arthur Nagel", normalizedName: "arthur nagel", tour: "ATP" },
  { id: "arthur-2", displayName: "Arthur Nagel", normalizedName: "arthur nagel", tour: "ATP" },
];

test("canonical screenshot identity resolves the known OCR names deterministically", () => {
  const index = buildCanonicalScreenshotIdentityIndex(players, []);

  for (const [input, id] of [
    ["Max Schoenhaus", "max"],
    ["Matteo Martineau", "matteo"],
    ["Francesco Maestrelli", "francesco"],
  ]) {
    const result = resolveCanonicalScreenshotName(input, index);
    assert.equal(result.status, "resolved");
    if (result.status === "resolved") assert.equal(result.player.id, id);
  }
});

test("verified aliases resolve to the canonical player, while unverified aliases do not", () => {
  const index = buildCanonicalScreenshotIdentityIndex(players.slice(0, 2), [
    {
      normalizedName: "m martineau",
      canonicalPlayerId: "matteo",
      verificationStatus: "verified",
    },
    {
      normalizedName: "max s",
      canonicalPlayerId: "max",
      verificationStatus: "pending",
    },
  ]);

  const verified = resolveCanonicalScreenshotName("M. Martineau", index);
  assert.equal(verified.status, "resolved");
  if (verified.status === "resolved") assert.equal(verified.player.id, "matteo");

  assert.equal(resolveCanonicalScreenshotName("Max S", index).status, "not-found");
});

test("duplicate canonical identities remain ambiguous instead of being guessed", () => {
  const index = buildCanonicalScreenshotIdentityIndex(players, []);
  const result = resolveCanonicalScreenshotName("Arthur Nagel", index);
  assert.equal(result.status, "ambiguous");
  if (result.status === "ambiguous") {
    assert.deepEqual(result.candidates.map((candidate) => candidate.id), ["arthur", "arthur-2"]);
  }

  // A provider hit cannot override a verified canonical collision.
  assert.equal(
    resolveCanonicalScreenshotName("Arthur Nagel", index).status,
    "ambiguous",
  );
  assert.equal(
    countConfidentProviderCandidates("arthur nagel", [{
      id: "provider-arthur",
      name: "Arthur Nagel",
      countryCode: null,
      currentRank: 1,
      tour: "ATP",
    }]),
    1,
  );
});

test("unknown OCR names remain unresolved for the bounded provider fallback", () => {
  const index = buildCanonicalScreenshotIdentityIndex(players, []);
  assert.deepEqual(resolveCanonicalScreenshotName("An Unknown OCR Name", index), { status: "not-found" });
});

test("multiple confident provider candidates remain ambiguous", () => {
  const candidates: PlayerSummary[] = [
    { id: "provider-a", name: "Provider Ambiguous", countryCode: null, currentRank: null, tour: "ATP" },
    { id: "provider-b", name: "Provider Ambiguous", countryCode: null, currentRank: null, tour: "ATP" },
  ];
  assert.equal(countConfidentProviderCandidates("provider ambiguous", candidates), 2);
});