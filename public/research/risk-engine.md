# Portfolio risk engine (risk-cvar-v5)

This is decision support on synthetic and user-supplied inputs. It is not a validated forecast or an instruction to buy. The risk assumptions below are explicit constants (`RISK_ASSUMPTIONS` in `src/lib/risk-scenarios.ts`, `TIMING_ASSUMPTIONS` in `src/lib/buy-window.ts`). They have not been calibrated on TBO data. No supplier is connected and no order is placed.

`risk-cvar-v5` is the default engine in the `/inventory` workspace. The legacy `scenario-grid-v4` is still available there through the **Planning engine** selector. Library and API callers keep v4 unless they pass `engine: 'risk-cvar-v5'`.

## Why a new engine

The v4 grid planner (see [portfolio-optimizer.md](portfolio-optimizer.md)) scored each product on its own, using three demand cases (25/50/25 at ±volatility). It used risk = E − r·(E − low case). Five things followed from that design:

- **Risk was per product, not per portfolio.** Ten Goa and Dubai positions can all lose money together in the same bad season. Independent cases cannot represent that, so the downside of concentrated plans was understated.
- **Only one contract type.** Every unit was a non-refundable pre-buy. There was no way to hold flexible allotment inventory with a deposit and release what does not sell.
- **Sold-outs were an arbitrary uplift.** Demand was multiplied by (1 + soldOut% × 0.2). Booking history is censored when a product sells out, which is exactly when demand is highest.
- **Timing came from quote expiry only.** There was no view of whether committing now beats waiting.
- **The budget counted full cost even for flexible supply.** Capital at risk is what a deposit-based contract actually puts on the line.

## What v5 does

1. **Demand with sold-out recovery** (`src/lib/demand-unconstraining.ts`). v5 uses the same blend, trend, seasonality, signal and cancellation terms as v4. The difference is that the booking term is replaced by *unconstrained* bookings, which add back the bookings turned away while the product was sold out:
   - If the optional `soldOutSearches` count is supplied: lost = soldOutSearches × conversion.
   - Otherwise: lost = min(soldOut% × searches × conversion, searches × conversion − bookings). The search-implied shortfall is capped by the sold-out share of searches, so ordinary conversion noise in periods that never sold out is not read as lost demand.
   - When recovery explains the whole gap, bookings and search demand agree. A fitted booking/search blend weight then has no effect on that product, and the workspace says so.
2. **Correlated seasons** (`src/lib/risk-scenarios.ts`). Each product's log-demand has a global factor and a regional factor (`REGION_BY_DESTINATION`: India, Middle East, South-East Asia, Indian Ocean, Europe, …; unknown destinations get their own region). This gives a correlation of 0.50 inside a region and 0.15 across regions. It is layered on the product's own volatility. The scenarios also include:
   - regional shocks: 4% per region-season, demand × 0.45–0.75;
   - global shocks: 2% per season, × 0.60–0.85;
   - achievable-price noise (σ 5%), with discounting to 0.85–0.95 of the price in shocked seasons;
   - cancellation-rate noise (σ 25%), × 1.5 in shocked seasons.

   Random streams are keyed by seed plus product id, so editing one row does not reshuffle the others.
3. **Two contract types per product** (`src/lib/risk-optimizer.ts`):
   - **Pre-paid:** pay `buy` per unit. Unsold units recover `recoveryPct`.
   - **Allotment:** hold units by paying `allotmentDepositPct` × `allotmentBuy`. Units that sell pay the full `allotmentBuy`, with the deposit credited. Unused units are released at cut-off and the deposit is forfeited. This is deliberately conservative: a contract with free release is better than modelled.
   - Demand fills whichever unit is more valuable first.
4. **Objective.** Maximise (1 − r) · E[season profit] + r · CVaR₁₀%, where CVaR₁₀% is the mean profit of the worst 10% of seasons. r is the existing risk slider (0–0.8). The plan must respect four constraints:
   - **Budget = capital at risk:** pre-paid cost + allotment deposits + fixed fee. The maximum budget is a hard limit.
   - **Supplier capacity:** the allotment capacity is capped at the product's capacity.
   - **Minimum order and fixed fee.**
   - **Quote expiry:** expired quotes cannot be bought.
5. **Solver with a proof of quality.** The solver searches 500 scenarios with whole units:
   - It uses a per-product quantity scan, removal-and-refill moves and two starting plans.
   - It then computes an upper bound on the best achievable objective: an exact per-product integer search inside a minimax dual, plus a Frank–Wolfe bound.
   - The reported gap is the chosen plan's distance below that bound. If the gap exceeds 0.5%, the search escalates automatically.
   - All headline metrics are re-scored on 2,000 *separate* out-of-sample scenarios, using seed 20261116 + 7919.
6. **Buy-window advisor** (`src/lib/buy-window.ts`). For each product it compares committing at every lead time against waiting. Waiting costs about 2% price drift per 30 days (capped at 8%). Pre-paying early ties up capital at 12% a year. Waiting is rewarded by forecast uncertainty that shrinks with lead time. The window is every lead time within 95% of the best. Labels: *Buy now · buy by DATE*, *Wait · window A → B*, *Late: spot / free-sale only*, *Travel period has started*.
7. **Strategy labels** follow from the decision rather than from fixed rules:
   - *Pre-buy + allotment*
   - *Allotment only*
   - *Consider pre-buy*
   - *Integrate / monitor*: demand is left unmet, so the gap should be covered by supplier integration or free-sale.
   - *Refresh supplier quote*

## Results on the demo dataset

Settings: 8 synthetic products, ₹50 L maximum budget, review date 16 Nov 2026. Each plan is scored on the same 2,000 out-of-sample seasons. "Served" is the share of forecast demand the plan can serve.

| Risk setting r | Engine | Expected profit | CVaR₁₀% | P(loss) | Served |
|---|---|---|---|---|---|
| 0 | v5 | ₹22.94 L | ₹10.22 L | 0.5% | 88.7% |
| 0 | v4 | ₹20.77 L | ₹7.51 L | 0.9% | 83.7% |
| 0.35 (default) | v5 | ₹22.59 L | ₹12.26 L | 0.1% | 84.2% |
| 0.35 (default) | v4 | ₹20.24 L | ₹10.81 L | 0.2% | 73.3% |
| 0.8 | v5 | ₹21.22 L | ₹13.41 L | 0.0% | 77.0% |
| 0.8 | v4 | ₹20.19 L | ₹10.91 L | 0.2% | 73.0% |

At the default setting, v5 commits ₹39.0 L of capital at risk, against ₹42.5 L for v4. The plan is 434 pre-paid units plus 195 allotment units. The certified gap is below 0.01%: the plan is ₹45 below a proven upper bound of ₹19,76,714 on the objective. Planning takes about 0.2–0.7 s in the browser, compared with about 50 ms for v4.

These numbers compare two methods **inside the same assumed world**. They show that v5 makes better decisions given these assumptions, not that the assumptions are right. The same scenario model is used for planning and scoring, although the scoring draws are separate.

## Validation

- `tests/risk-optimizer.test.ts` (9 tests):
  - **Optimality:** the upper bound holds, and on 60 random tiny cases checked by exhaustive enumeration every plan is within 3% of the true optimum.
  - **Hard constraints:** every plan respects budget, capacity, minimum order, fee and quote expiry.
  - **Scenarios:** scenario sets are deterministic, keyed per product and correlated by region.
  - **Risk appetite:** a higher setting trades expected profit for tail protection.
  - **Allotments:** they are used when deposits make them the cheaper risk.
  - **Against v4:** v5 beats the v4 plan on the demo inputs under the same scenarios.
  - **What-if tools:** they replan with the engine that produced the rows.
  - **Compatibility:** the default engine is unchanged for existing callers.
- `tests/demand-unconstraining.test.ts` (4 tests):
  - A consistent censored history is recovered exactly.
  - Measured `soldOutSearches` overrides the even-spread estimate.
  - With no sell-outs, the forecast equals v4's.
  - A **real-data censoring check** uses public hotel booking requests (TidyTuesday `hotels.csv`, City and Resort hotels, Jan–Jun 2016; 12 hotel-months).
    - Method: daily demand is capped at each hotel's 80th-percentile day to simulate sell-outs. Each method then estimates the true monthly demand.
    - Monthly MAPE: raw censored bookings 10.5%; v4 uplift 7.2%; v5 without `soldOutSearches` 1.4%; v5 with measured `soldOutSearches` 0.4%.
    - This is one public dataset with simulated censoring. Repeat the check on TBO's own sold-out logs.
- `tests/buy-window.test.ts` (3 tests): travel-period parsing, the statistical helpers, and the four statuses (past, late, buy now, wait).
- `tests/inventory-csv-allotments.test.ts`: the new CSV columns parse, round-trip and are validated. Older files without them still plan.
- `tests/plan-api.test.ts`, against a running server: the API engine switch works, an unknown engine returns 400, and the v5 summary fields are present.
- `tests/fitted-demand.e2e.cjs`: v4 still behaves exactly as before, a fitted blend weight reaches the v5 API, and the workspace explains when the weight is moot.

## Data contract (to replace the assumptions)

| Need | Field / source | Replaces |
|---|---|---|
| Dated bookings, searches and availability per product-day | TBO booking and search logs | trend, seasonality and the default 0.55 blend weight |
| Searches that found the product sold out | `soldOutSearches` | the capped estimate based on soldOut% |
| Allotment price, deposit, release cut-off and capacity | `allotmentBuy`, `allotmentDepositPct`, `allotmentCapacity` (+ cut-off date, future work) | the synthetic demo terms |
| Cross-destination demand co-movement and historical shocks | multi-season booking history | `RISK_ASSUMPTIONS` correlation and shock settings |
| Supplier price paths by lead time | quote history | `TIMING_ASSUMPTIONS.driftPerMonth` / `maxDrift` |

## Limitations

- **Pricing.** The selling price is chosen per product before allocation, using v4's five-price search. It is not optimised jointly with quantities. Cross-product substitution is not modelled.
- **Allotments.** Release has a single cut-off. Contracts with free release or partial release penalties need extra terms.
- **Scope.** Shocks are scenario assumptions, not forecasts of specific events. The engine shares v4's 20-row / 3,000-unit CSV and API limits.

## API

```http
POST /api/procurement/plan
{"items":[...], "budget":5000000, "risk":0.35, "asOf":"2026-11-16", "engine":"risk-cvar-v5"}
```

- `engine` is optional. It defaults to `scenario-grid-v4`; any other value returns 400.
- With v5, `summary` adds `cvar10`, `lossProbability`, `demandServedShare`, `demandServedShareBefore`, `prepaidUnits` and `allotmentUnits`.
- `optimization.risk` carries the full risk summary, including the profit histogram.
- `model` reports the engine (with `-experimental-blend` when a fitted blend is applied).
- Saved private plans record the model version. Projects created before v5 must apply [`docs/security/allow-risk-cvar-v5.sql`](../../docs/security/allow-risk-cvar-v5.sql) before v5 plans can be saved.
