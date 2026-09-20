import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { AUDIT_OPERATION_HANDLERS } from "./truthAuditOperationRegistry";

test("every named operation emitted by the audit client has a registered handler", () => {
  const root = join(process.cwd(), "../../artifacts/tennis-truth-engine/src/lib");
  const source = [
    readFileSync(join(root, "audit-repo.server.ts"), "utf8"),
    readFileSync(join(root, "audit-runs.ts"), "utf8"),
  ].join("\n");
  const emitted = new Set<string>();
  for (const match of source.matchAll(/(?:op|truthServerOperation)\("([^"]+)"/g)) emitted.add(match[1]!);
  for (const operation of emitted) assert.ok(AUDIT_OPERATION_HANDLERS.has(operation), `missing handler for ${operation}`);
});