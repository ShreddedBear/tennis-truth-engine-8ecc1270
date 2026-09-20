# Evidence Coverage Phase 21

This phase adds fail-closed representative sampling from already-verified BSD PBP history indexes when production tables do not contain enough persisted match/paired-observation rows to construct ATP Main, WTA Main, and ATP Challenger diagnostic representatives. The sampler accepts only structurally present rows with explicit circuit/category guards, valid distinct player names, a match id, and an in-boundary event date. It is diagnostic-only and does not mutate ingestion, source adapters, OIDC, deployment authentication, or Historical Hard Pull workflows.
