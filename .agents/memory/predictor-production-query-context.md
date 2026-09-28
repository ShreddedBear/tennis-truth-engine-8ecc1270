---
name: Predictor production query context
description: Why Predictor development can render while the compiled app loses React Query context.
---

A workspace-linked API client can make a Vite production build include a second React Query module even when the development server renders normally. Components using one module's context cannot see a provider created by the other module.

**Why:** The published Predictor and a fresh local production build both showed “No QueryClient set” despite a correctly nested provider in source and a working development preview.

**How to apply:** Keep React Query deduplicated at the bundler boundary and run a browser against the compiled production output before declaring a rendering fix. The production-bundle guard should detect another duplicate if dependency resolution changes.