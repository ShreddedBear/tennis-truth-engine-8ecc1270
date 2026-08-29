#!/usr/bin/env bash
set -euo pipefail

bun install --frozen-lockfile
node scripts/build-runtime-tennis-index.mjs