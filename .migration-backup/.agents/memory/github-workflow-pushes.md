---
name: GitHub workflow pushes
description: Authentication requirements for pushing workflow-file changes from this Replit workspace.
---

For terminal Git operations, use a temporary Basic authorization header with `x-access-token` rather than an API-style Bearer header. A classic GitHub PAT must include both `repo` and `workflow` when outgoing commits create or modify files under `.github/workflows/`.

**Why:** GitHub accepted the token for REST API requests but rejected Git smart-HTTP Bearer authentication. After Basic authentication succeeded, the server still rejected the branch update until the token reported both `repo` and `workflow`.

**How to apply:** Before a push involving workflow files, inspect GitHub's returned OAuth scope names without exposing the token. Keep credentials out of remote URLs and persistent Git configuration; pass the Basic header only to the individual fetch, `ls-remote`, or push command.