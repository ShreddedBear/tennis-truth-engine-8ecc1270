import { createHash } from "node:crypto";
import type { HistoricalFixture } from "../tennisData/types";
import {
  stableSerialize,
  type HoldoutAdmission,
} from "./liveTennisHoldoutAdmission";

export interface HoldoutFreezeMetadata {
  id: string;
  windowFrom: string;
  windowTo: string;
  candidateFingerprint: string;
  eligibleFingerprint: string;
  candidateCount: number;
  eligibleCount: number;
  provenance: {
    authority: "deterministic-holdout-admission";
    method: "exact-signature-independent-outcome";
    source: "Live Tennis API + Approved Sackmann Warehouse";
  };
}

export function holdoutFreezeId(eligibleFingerprint: string): string {
  return `live-tennis-holdout-${eligibleFingerprint}`;
}

export function buildHoldoutFreezeMetadata(input: Omit<HoldoutFreezeMetadata, "id" | "provenance">): HoldoutFreezeMetadata {
  return {
    ...input,
    id: holdoutFreezeId(input.eligibleFingerprint),
    provenance: {
      authority: "deterministic-holdout-admission",
      method: "exact-signature-independent-outcome",
      source: "Live Tennis API + Approved Sackmann Warehouse",
    },
  };
}

export function fingerprintFreezeMembers(
  members: Array<{ fixture: HistoricalFixture; admission: HoldoutAdmission }>,
): string {
  const stable = members.map(({ fixture, admission }) => ({
    fixture,
    admission,
  })).sort((left, right) => left.fixture.id.localeCompare(right.fixture.id));
  return createHash("sha256").update(stableSerialize(stable)).digest("hex");
}
