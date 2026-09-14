import { describe, expect, it } from "vitest";

import { canonicalJson, contentChecksum } from "../../scripts/db-migrate/shared";

// The content checksum is what db:verify compares, and it has to mean the same thing on
// both sides of a migration even though the two sides read rows differently: the direct
// export goes through the pg driver, the Data API export receives parsed JSON, and the
// target is read back through pg again. If those disagree about how to render a value, the
// checksum reports a difference that is not there -- or worse, agrees when it should not.

describe("canonical JSON", () => {
  it("does not depend on key order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("sorts keys at every depth", () => {
    expect(canonicalJson({ x: { b: 1, a: 2 } })).toBe(canonicalJson({ x: { a: 2, b: 1 } }));
  });

  it("renders a Date and its ISO string identically", () => {
    // The whole point: pg may hand back a Date where HTTP hands back the string.
    expect(canonicalJson({ at: new Date("2026-09-12T11:10:36.335Z") }))
      .toBe(canonicalJson({ at: "2026-09-12T11:10:36.335Z" }));
  });

  it("keeps array order significant", () => {
    // Arrays are values, not sets: [1,2] and [2,1] are different data.
    expect(canonicalJson({ a: [1, 2] })).not.toBe(canonicalJson({ a: [2, 1] }));
  });

  it("distinguishes an empty array from an empty object", () => {
    // This is the exact corruption a jsonb [] suffered when passed as a query parameter.
    expect(canonicalJson({ a: [] })).not.toBe(canonicalJson({ a: {} }));
  });

  it("distinguishes null from absent from empty string", () => {
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({ a: "" }));
    expect(canonicalJson({ a: undefined })).toBe(canonicalJson({}));
  });

  it("does not conflate a number with its string form", () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: "1" }));
  });
});

describe("content checksum", () => {
  const rows = [
    { id: "b", value: 2, at: "2026-09-12T11:10:36.335Z" },
    { id: "a", value: 1, at: "2026-09-11T09:00:00.000Z" },
  ];

  it("does not depend on row order", () => {
    expect(contentChecksum(rows)).toBe(contentChecksum([...rows].reverse()));
  });

  it("is stable across repeated computation", () => {
    expect(contentChecksum(rows)).toBe(contentChecksum(rows));
  });

  it("agrees whether timestamps arrived as Dates or as strings", () => {
    const viaDriver = rows.map((r) => ({ ...r, at: new Date(r.at) }));
    expect(contentChecksum(viaDriver)).toBe(contentChecksum(rows));
  });

  it("changes when a single value changes", () => {
    const tampered = [{ ...rows[0]!, value: 3 }, rows[1]!];
    expect(contentChecksum(tampered)).not.toBe(contentChecksum(rows));
  });

  it("changes when a row is dropped", () => {
    expect(contentChecksum([rows[0]!])).not.toBe(contentChecksum(rows));
  });

  it("changes when a row is duplicated", () => {
    // Order-independence must not become multiset-blindness.
    expect(contentChecksum([...rows, rows[0]!])).not.toBe(contentChecksum(rows));
  });

  it("reports empty rather than a hash of nothing", () => {
    expect(contentChecksum([])).toBe("empty");
  });
});
