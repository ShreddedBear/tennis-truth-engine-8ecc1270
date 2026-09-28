# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Before every publish, run the production smoke test** (`pnpm run smoke:production` after building all three artifacts; `.github/workflows/production-smoke.yml` shows the exact build steps and env). It runs the *built* API, Tennis Matrix AI and Truth Engine behind one origin and checks in a browser that pages render with no failed same-origin assets. A successful build, a working `vite dev` preview, and HTTP 200 have each been true during real outages; none of them prove the published site works.
- Past outages the smoke test and build guards now catch (do not reintroduce):
  - Truth Engine: a root `index.html` becomes Nitro's production renderer (blank page); Nitro `baseURL` not matching `BASE_PATH` (every asset 404s); an auto-generated Cloudflare `compatibility_date` newer than the installed workerd (Worker won't start). Guarded by `artifacts/tennis-truth-engine/scripts/check-production-entry.mjs`.
  - Tennis Matrix AI: two copies of `@tanstack/react-query` in the production bundle crash every page with "No QueryClient set" (dev mode hides it). Keep it in `resolve.dedupe`; guarded by `artifacts/tennis-predictor/scripts/check-production-bundle.mjs`.
  - API server: `/api/healthz` (the deployment health check) must not depend on Clerk or any other per-request middleware, and a missing `CLERK_SECRET_KEY` must not take down public routes. Covered by `pnpm --filter @workspace/api-server run test:healthz`.
- Never delete a `postbuild` guard or loosen its check to make a build pass; fix the cause it reports.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
