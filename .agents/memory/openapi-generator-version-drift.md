---
name: OpenAPI generator version drift
description: Why the current OpenAPI codegen command can rewrite generated files into an incompatible form.
---

The API specification package declares an Orval 8.20-compatible range, but dependency resolution currently installs Orval 8.30. That generator emits Zod 4-only calls such as `zod.int()` while the workspace uses Zod 3, and it also regenerates payment schemas that collide with existing manual exports.

**Why:** A fixture-response contract extension triggered a large generated diff and hundreds of unrelated library type errors. Running the baseline 8.20 generator directly was blocked by the package firewall, so the generated changes had to be removed and the response contract left unchanged.

**How to apply:** Before changing the OpenAPI contract, align the supported Orval and Zod versions and resolve manual/generated payment export collisions. Do not keep or hand-edit partially generated output from a failed codegen run.