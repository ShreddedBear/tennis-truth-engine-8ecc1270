# PHASE 1 — STEP 0: IDENTITY CONFIRMATION

**Audit date:** 2026-09-18
**Auditor:** Claude (read-only forensic audit)
**Status:** IDENTITY CONFIRMED — NO DISCREPANCY WITH PROMPT LABELS

---

## 1. `ShreddedBear/tennis-truth-engine-8ecc1270` — what it actually contains

- **README.md** (root, 3111 lines) describes a "TENNIS MATRIX INDEPENDENT VERIFICATION & AUDIT SYSTEM" — an audit engine that ingests Matrix PDF match summaries, independently researches players, runs a Verification Audit / Disagreement-Trap Audit / Dangerous Underdog Audit / stress tests, applies a historical-record calibration ledger, and issues DOUBLE GREEN/GREEN/YELLOW/RED-PASS/INCOMPLETE verdicts. It explicitly separates "BRANCH A — MATRIX" (external prediction data) from "BRANCH B — INDEPENDENT AUDIT" and forbids Matrix-derived signals from satisfying independent-evidence requirements ("Matrix Firewall").
- **package.json**: `tanstack_start_ts`, TanStack Start/Router + Vite + React 19 + `@supabase/supabase-js` + `pdfjs-dist`/`tesseract.js` (PDF/OCR ingestion) + `jspdf` (report generation). Scripts include `build-runtime-tennis-index.mjs` (pre-build/pre-dev hook).
- **Top-level structure**: `src/{components,generated,hooks,integrations,lib,routes}`, `supabase/{config.toml,migrations,security}`, `data/`, `docs/`, `scripts/`.
- **Code search**: **zero** hits for "parlay" anywhere under `src/`. "Prediction engine" appears only in two files (`truth-engine-refusal-forensics.ts`, `truth-engine-audit.test.ts`) that reference the *concept* in an audit/forensics context, not an implementation.

**Conclusion: this repo is the audit/verification layer** (it checks another app's predictions against independently-collected evidence). It does **not** currently contain a Prediction Engine or a Parlay Builder.

---

## 2. `ShreddedBear/Tennis-Stats-Engine` — what it actually contains

- No root `README.md`; the operative doc is `replit.md`: **"Tennis Match Predictor — a tennis match prediction app: pick two players, get a calibrated win probability backed by a multi-module prediction engine (surface Elo, serve/return, recent form, fatigue, style matchup, head-to-head), plus a growing leak-proof historical match database for future model validation."**
- **package.json**: pnpm-workspace monorepo (`workspace`), Node 24 + TypeScript, Express 5 API, **PostgreSQL + Drizzle ORM**, Zod/`drizzle-zod`, Orval-generated API client, esbuild.
- **Top-level structure**: `artifacts/{api-server,tennis-predictor}`, `lib/{api-client-react,api-spec,api-zod,db,integrations-openai-ai-server}`, `docs/`, `scripts/`, `tools/`.
- **Code search confirms both named components exist as real implementations**:
  - `artifacts/api-server/src/services/predictionEngine/` — "live, per-request prediction modules" (per `replit.md`).
  - `artifacts/api-server/src/services/parlayBuilder/` — `builderScoringService.ts`, `builderProviderFetch.ts`, `webResearchService.ts`, `matchstatScraper.ts`, `sofascoreProvider.ts`, plus tests, and a `AdminParlayBuilder.tsx` frontend page in `artifacts/tennis-predictor/`.
  - `lib/db/src/schema/predictions.ts` (live predictions + outcomes) and `lib/db/src/schema/historicalMatches.ts` (append-only historical matches + frozen pre-match feature snapshots) confirm a running Prediction Engine backed by its own schema.

**Conclusion: this repo is the actual Prediction Engine + Parlay Builder application**, plus its own historical-match database infrastructure.

---

## 3. Destination vs. source determination

Based on what was actually found (not on the prompt's labels alone):

- **`tennis-truth-engine-8ecc1270` = the audit/verification layer** that is meant to check another app's predictions. It matches the prompt's "DESTINATION / PRIMARY" label.
- **`Tennis-Stats-Engine` = the Prediction Engine + Parlay Builder application** ("source / infrastructure to merge in" per the prompt).

## 4. Discrepancy check

**No discrepancy found.** The prompt's architecture labels match what was actually read in both repos. Proceeding is not blocked on this point.

---

## 5. Database backend per repo (read from actual config/connection code)

| Repo | Backend | Evidence |
|---|---|---|
| `tennis-truth-engine-8ecc1270` | **Supabase** | `supabase/config.toml` (`project_id = "qyovnrkiknsiqjybxubf"`), `supabase/migrations/`, `supabase/security/`, `@supabase/supabase-js` dependency, `src/integrations/supabase/{client.ts,client.server.ts,auth-middleware.ts,cron-auth.ts}` reading `VITE_SUPABASE_URL` / `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`. Also uses Git LFS for `data/generated/tennis-runtime-index.json` (per `.gitattributes`). |
| `Tennis-Stats-Engine` | **PostgreSQL (via Drizzle ORM), not Supabase** | `replit.md`: "DB: PostgreSQL + Drizzle ORM"; required env `DATABASE_URL` (Postgres connection string); `lib/db` package; `lib/db/drizzle.config.ts`; no `@supabase/*` dependency or `supabase/` directory found. |

These are **different, incompatible database backends** — this is a material migration risk that Phase C (Steps 6–9) must address in detail; flagging now per the cost/stopping rule so it isn't lost.

---

## 6. Access / capability boundary — what I actually have

- **`tennis-truth-engine-8ecc1270`**: full local git clone (already the working tree), on branch `claude/tennis-repos-consolidation-audit-0pydde`, clean working tree. GitHub MCP tools (`mcp__github__*`) are available and this repo is in the session's Repository Scope, so GitHub API access (PRs, issues, branches, commits) is available for it.
- **`Tennis-Stats-Engine`**: added via `add_repo` with **read-only** access. This resolved to: no attach needed — the session's git proxy serves **anonymous public-repo git reads** directly. I performed a **shallow (`--depth 1`), single-branch (`main`), LFS-smudge-skipped** clone to `/home/user/shreddedbear/tennis-stats-engine`. I do **not** have: push access, GitHub API access (issues/PRs/reviews) via `mcp__github__*` (it is outside the session's Repository Scope), or Git LFS object access for this repo through the anonymous read lane.
- **Database access**: **none** to either repo's live database. No Supabase project credentials/session and no Postgres `DATABASE_URL` connection are available in this environment. All database findings in later phases will be sourced from migration/schema files in the repos only, and will be explicitly marked `UNKNOWN — LIVE DATABASE NOT ACCESSIBLE` where live state would be needed.
- **Deployment access**: none (no Replit, Vercel, or other deployment platform access confirmed).
- **Filesystem access**: full, for both local clones.

**I will not promise to verify anything beyond this boundary in later phases.**

## 7. Can I inspect all remote branches and their contents?

- **Partially, and asymmetrically between the two repos.**
- I obtained a complete list of remote branch refs for **both** repos via `git ls-remote --heads` (no clone required for the listing itself):
  - `tennis-truth-engine-8ecc1270`: **90 branches** (listed by SHA in raw command output this turn; not yet reproduced into a manifest file — deferred to Phase A / Step 1 per the phased working method).
  - `Tennis-Stats-Engine`: **26 branches** (also listed this turn).
- I have **not yet cloned or fetched the contents of any branch other than each repo's default branch** (`main` for both). Doing so for all 90+26 branches is exactly the kind of potentially-disproportionate operation the cost/stopping rule calls out — Phase A (Step 1) will fetch and inspect branches prioritized by relevance (production code, recent activity, branch names suggesting prediction-engine/parlay-builder/audit content) rather than exhaustively cloning all 116 branches in full, and will mark any branch not inspected as `UNKNOWN` with the reason stated.
- No tags exist on either repo (`git ls-remote --tags` returned empty for both).

## 8. Can I inspect Git LFS objects, submodules, tags, and full history?

- **Tags**: none exist on either repo (confirmed above) — nothing to inspect.
- **Submodules**: none exist on either repo (no `.gitmodules` file in either repo's root) — nothing to inspect.
- **Git LFS objects**: `tennis-truth-engine-8ecc1270` declares one LFS-tracked path (`data/generated/tennis-runtime-index.json`) in `.gitattributes`; since this is my own working tree (full clone, not the anonymous read lane), LFS objects for it should be fetchable normally in a later phase. `Tennis-Stats-Engine` has **no `.gitattributes` file** at all, so it does not appear to use Git LFS — its clone was still done with `GIT_LFS_SKIP_SMUDGE=1` as a precaution and this will be re-verified in Phase A.
- **Full history**: `tennis-truth-engine-8ecc1270` — full history available (normal clone, not shallow). `Tennis-Stats-Engine` — **currently only a shallow (`--depth 1`), single-branch clone**; full history is not yet available locally and will require a bounded deepen (`git fetch --depth=1000` or similar) in Phase A/D if commit-level history audit is needed. This is marked `UNKNOWN` pending that fetch.

---

## Security note (checked, no finding)

`Tennis-Stats-Engine` has a root-level file literally named `GEOAPIFY_API_KEY` (11,227 bytes). Inspected: it is a **Python script** (`build_tournament_coordinates.py`-adjacent tooling) that reads `os.getenv("GEOAPIFY_API_KEY")` at runtime — it does **not** contain an actual secret value. Not treated as a security finding, but its misleading filename is noted for the Step 12 / Step 17 security audit in a later phase.

---

## Verdict for Step 0

**IDENTITY AND ACCESS CONFIRMED.** No discrepancy with the prompt's architecture labels. Proceeding to Phase A (Steps 1–2: repo & branch inventory) is authorized once you confirm.

Per the phase checkpoint rule, **this turn ends here.** Phase A has not yet been performed beyond the branch-ref listings already captured above.
