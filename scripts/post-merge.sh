#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm run verify:restoration
pnpm --filter db push
