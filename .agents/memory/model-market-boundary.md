---
name: Model and market boundary
description: The confirmed separation between official tennis probability, market analysis, and parlay qualification.
---

The official model probability, calibration, and confidence must be produced from tennis evidence without live sportsbook prices changing them. Market odds remain fully integrated as separate market probability, fair-price, edge, EV, disagreement, and audit outputs.

**Why:** The user confirmed that market information is important and must remain in the Prediction Engine experience and Parlay Builder, but repeatedly specified that the model determines probability while the market determines price. Letting current prices silently alter the official probability destroys that distinction.

**How to apply:** Production predictions fetch and preserve odds but do not pass them into the official tennis-only engine run. Keep controlled market-consensus ablation available for research. The independent Parlay Builder may use market price, EV, and disagreement when deciding whether a prediction qualifies as a leg, without rewriting the underlying model probability.