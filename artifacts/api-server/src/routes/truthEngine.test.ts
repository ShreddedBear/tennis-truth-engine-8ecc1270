import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { idParam } from "./truthEngine";

test("Truth Engine UUID route parameters reject malformed identifiers", () => {
  assert.equal(idParam("not-a-uuid"), null);
  assert.equal(idParam(["not-a-uuid"]), null);
  assert.equal(idParam("00000000-0000-0000-0000-000000000001"), "00000000-0000-0000-0000-000000000001");
});

test("browser-facing Truth mutations require admin middleware", () => {
  const source = readFileSync(new URL("./truthEngine.ts", import.meta.url), "utf8");
  const mutations = [...source.matchAll(/router\.(post|patch|delete)\("([^"]+)"/g)]
    .filter(([, , path]) => !path.includes("/internal/"));
  assert.ok(mutations.length > 0);
  for (const [, method, path] of mutations) {
    const declaration = source.slice(source.indexOf(`router.${method}("${path}"`), source.indexOf("\n", source.indexOf(`router.${method}("${path}"`)));
    assert.match(declaration, /requireAdmin/, `${method.toUpperCase()} ${path} must require admin`);
  }
});

test("cross-workspace Truth updates include ownership predicates", () => {
  const source = readFileSync(new URL("./truthEngine.ts", import.meta.url), "utf8");
  const conflictUpdate = source.slice(source.indexOf('update source_conflicts'));
  const resultUpdate = source.slice(source.indexOf('update ${sql.raw(table)}'));
  const matchUpdate = source.slice(source.indexOf("update matches set"));
  assert.match(conflictUpdate.slice(0, conflictUpdate.indexOf("returning")), /user_id = .*WORKSPACE_ID/);
  assert.match(resultUpdate.slice(0, resultUpdate.indexOf("returning")), /user_id = .*WORKSPACE_ID/);
  assert.match(matchUpdate.slice(0, matchUpdate.indexOf("returning")), /user_id = .*WORKSPACE_ID/);
});