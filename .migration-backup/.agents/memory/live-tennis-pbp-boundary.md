---
name: Live Tennis PBP boundary
description: Access and historical-boundary constraints for Live Tennis API point-by-point evidence.
---

Treat Live Tennis API point-by-point coverage in three separate bands: current-plan tapes verified from 2023 onward; reconstructed archive tapes advertised for 2013–2022 but requiring ULTRA or a History entitlement; and results-only records through 2012.

**Why:** A paid key can list matches back to 2010 while still returning `upgrade_required` for archive tapes. Match discovery is not proof of usable point-by-point access.

**How to apply:** Before integrating older evidence, probe actual tape responses with the active entitlement. Keep restricted responses, absent tapes, and verified point rows as separate outcomes.