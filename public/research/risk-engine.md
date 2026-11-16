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
   - **Budget (hard limit):** by default the cash committed — pre-paid cost + the full value of allotment units + fixed fee (`budgetBasis: "cash"`). Optionally capital at risk, where allotment units count only their deposit (`budgetBasis: "capital-at-risk"`).
   - **Supplier capacity:** the allotment capacity is capped at the product's capacity.
   - **Minimum order and fixed fee.**
   - **Quote expiry:** expired quotes cannot be bought.
5. **Solver with a proof of quality.** Since Stage 4, the default is the scenario-weight decomposition described under *Large portfolios* below. The original local search, described here, remains available as `solver: "local-search"`. It searches 500 scenarios with whole units:
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
| 0 | v5 | ₹17.10 L | ₹7.85 L | 0.5% | 76.5% |
| 0 | v4 | ₹−0.88 L | ₹−14.55 L | 54.8% | 51.7% |
| 0.35 (default) | v5 | ₹16.89 L | ₹9.23 L | 0.2% | 74.7% |
| 0.35 (default) | v4 | ₹4.37 L | ₹−8.21 L | 24.6% | 50.1% |
| 0.8 | v5 | ₹16.44 L | ₹9.83 L | 0.1% | 72.9% |
| 0.8 | v4 | ₹4.56 L | ₹−7.98 L | 23.8% | 50.1% |

(November 2026: cash budget, data-driven price response, decomposition solver.) At the default setting, v5 commits ₹49.99 L of cash, against ₹42.5 L for v4: 467 pre-paid units plus 124 allotment units. The certified gap is 0.009%: the plan's objective is ₹129 below a proven upper bound of ₹15,01,188.

Why v4 looks so much worse than in earlier versions of this table: v4 assumes a price elasticity of −1.2, so it marks every product up 10%. In the planning world, demand responds with each product's own elasticity (the Lerner-implied −3 to −3.5 for the demo; mark-ups lose demand twice as fast as discounts win it). There, those mark-ups lose most bookings, and v4's pre-paid units go unsold in about a quarter of seasons. This shows why the price response has to be estimated rather than assumed. It is not a test of v4 under its own assumptions. Planning takes about 0.2–0.7 s in the browser, compared with about 50 ms for v4.

These numbers compare two methods **inside the same assumed world**. They show that v5 makes better decisions given these assumptions, not that the assumptions are right. The same scenario model is used for planning and scoring, although the scoring draws are separate.

## Additions: joint pricing, availability target, model-risk check, supplier priorities

These were added on the same branch after the first v5 release. Unless stated otherwise, every number below uses the 8 demo products, a ₹50 L cash budget, r = 0.35 and review date 16 Nov 2026, scored on the same 2,000 out-of-sample seasons. The numbers were refreshed in November 2026 for the current engine (cash budget, data-driven price response, decomposition solver).

### Joint price and quantity search

- **What it does.** Each product starts at its stand-alone best price. The search can then move any product to another of its 13 candidate prices (the reference price ±15% in 2.5% steps) and re-optimises the units with it. Demand responds with each product's own elasticity (see *Pricing* under *Limitations*).
- **Upper bound.** The proven upper bound takes the best price, pre-paid quantity and allotment quantity for every product, so the certified gap still holds with prices chosen jointly.
- **Pair move.** A move handles plans where no single product pays on its own but a diversified pair does: when the plan is empty, the search tries the smallest increment of every pair of products. It does nothing when the plan is not empty.
- **Demo results** (r = 0.35):

| Budget | Gain over fixed prices | Prices chosen |
|---|---|---|
| ₹50 L | none | all at the reference price |
| ₹30 L | +8.5% | 2.5–10% above reference |
| ₹20 L | +18.4% | 7.5–15% above reference |

  When the budget is tight, supply is scarce and a mark-up rations it to the most profitable demand. With enough budget, the reference prices are already best.
- **Guarantee.** Up to 30 products, the joint search starts from the fixed-price plan, so it never returns a worse plan than fixed pricing. A unit test checks this at r = 0, 0.35 and 0.8.
- **Test.** On 24 random tiny cases, every price and quantity combination was enumerated. The bound is never below the true joint optimum, and the plan is within 3% of it. The PS harness's D3 check adds 30 larger cases (see *Large portfolios*).
- **Switching it off.** `jointPricing: false` keeps each product at its stand-alone price.

### Availability target ("serve at least X% of demand")

- **The control.** In the risk panel, the planner can require the plan to serve at least 85%, 90% or 95% of modelled demand. API callers can pass any target from 0 to 0.99. Served demand includes existing stock.
- **How it works.** Every unit sold gets an extra "service value" μ in the objective. The engine searches for the smallest μ that makes the optimal plan reach the target (doubling, then bisection), keeping the no-target selling prices: the target is met by buying more cover, not by discounting to create demand. This is a standard Lagrangian treatment. The objective stays concave, so the proven bound still applies to the service-augmented objective.
- **What it reports.** μ is the implied value of one extra booking served. The panel also shows the expected profit and the worst-10% profit given up.
- **When the target cannot be reached.** If budget or supplier capacity cannot reach the target, the plan is left unchanged and the panel shows roughly the most this budget can serve.
- **Results** (cash budget basis):

| Budget | Target | Status | Served | Cash committed | Expected profit change | Worst-10% change | Implied value per extra booking |
|---|---|---|---|---|---|---|---|
| ₹50 L | none | — | 74.7% | ₹49.99 L | — | — | — |
| ₹50 L | 80%, 85%, 90% or 95% | out of reach | about 79.6% at most | — | — | — | — |
| ₹70 L | none | — | 81.7% | ₹57.87 L | — | — | — |
| ₹70 L | 85% | met | 85.7% | ₹62.30 L | +₹0.22 L | −₹1.17 L | ₹1,593 |
| ₹70 L | 90% | met | 90.6% | ₹68.80 L (594 pre-paid + 220 allotment units) | −₹0.15 L | −₹3.87 L | ₹6,373 |
| ₹70 L | 95% | out of reach | about 92.5% at most | — | — | — | — |

At ₹50 L on the cash basis, the budget limits availability: about 80% is the most it can serve. At ₹70 L, the plan without a target stops at ₹57.87 L because extra units lower the risk-adjusted objective. Going from 82% to 91% availability then costs only ₹0.15 L of expected profit; the price is tail risk (₹3.87 L of worst-10% profit). The 85% target even raises expected profit slightly, because the no-target plan trades some expected profit for a better worst case.

- **Consistency across the app.** The target travels with the plan rows, so the following all re-plan under the same target: budget comparison, stress re-plans, quote impact, landed cost, Trends what-if, the decision record and the planning API check.
- **Run time.** Adding a target costs about 0.2 s per re-plan on the demo.
- **Limitation.** The target is checked on the 500 planning seasons. The out-of-sample share can differ by a few tenths of a percentage point.

### Model-risk check (mismatched worlds)

**What it does.** Every plan is optimised under the assumptions in `RISK_ASSUMPTIONS`. The check (`src/lib/model-risk.ts`, on the stress-test page and via `modelRisk: true` in the API) keeps the decisions fixed and scores them in 11 worlds:
- as planned;
- demand 15% below forecast;
- demand 15% above forecast;
- selling prices 5% lower;
- customers less price-sensitive (0.4× the assumed elasticity, about the −1.2 that v4 assumes);
- customers more price-sensitive (1.5× the assumed elasticity);
- cancellations ×1.5;
- demand 1.5× more volatile;
- destinations moving together (same-region correlation 0.80 and cross-region 0.40, instead of 0.50 and 0.15);
- shocks 3× as likely;
- several of these at once.

**How it compares.** All worlds use the same random draws (common random numbers), so differences come from the assumption change, not from sampling noise. Each world compares v5 with v4 and with an "oracle": a plan re-optimised knowing the world in advance. Regret is the oracle's risk-adjusted result minus the plan's.

**Results** (risk-adjusted result = 0.65·E + 0.35·CVaR₁₀%):

| World | v5 result | v5 regret | v4 result | v4 regret |
|---|---|---|---|---|
| As planned | ₹14.21 L | ₹0.00 L | ₹−0.03 L | ₹14.24 L |
| Demand −15% | ₹11.84 L | ₹0.40 L | ₹−5.73 L | ₹17.97 L |
| Demand +15% | ₹15.51 L | ₹0.18 L | ₹4.97 L | ₹10.72 L |
| Prices −5% | ₹11.12 L | ₹0.01 L | ₹−2.08 L | ₹13.21 L |
| Customers less price-sensitive | ₹14.21 L | ₹2.58 L | ₹13.91 L | ₹2.87 L |
| Customers more price-sensitive | ₹14.21 L | ₹0.00 L | ₹−11.38 L | ₹25.59 L |
| Cancellations ×1.5 | ₹13.16 L | ₹0.09 L | ₹−2.35 L | ₹15.60 L |
| Volatility ×1.5 | ₹11.58 L | ₹0.46 L | ₹−2.73 L | ₹14.77 L |
| Destinations move together | ₹13.98 L | ₹0.06 L | ₹−0.82 L | ₹14.85 L |
| Shocks ×3 | ₹11.11 L | ₹0.36 L | ₹−3.42 L | ₹14.89 L |
| Several wrong at once | ₹7.01 L | ₹1.44 L | ₹−8.74 L | ₹17.19 L |

**Across risk settings.** v5 has the higher risk-adjusted result and the higher worst-10% profit in all 11 worlds at r = 0, 0.35 and 0.8:

| Risk setting r | v5 average regret | v4 average regret |
|---|---|---|
| 0 | ₹0.53 L | ₹18.17 L |
| 0.35 | ₹0.51 L | ₹14.72 L |
| 0.8 | ₹0.68 L | ₹17.27 L |

**Read the v4 numbers carefully.** Most of v4's regret comes from one assumption. It prices as if demand had an elasticity of −1.2, so it marks every product up 10%. Where customers are as price-sensitive as the data suggest (−3 to −3.5 for the demo), those mark-ups lose bookings. In the world where customers really are about as price-insensitive as v4 assumes, v4 does far better (₹13.91 L), and v5 still edges it (₹14.21 L). That world is also v5's largest regret (₹2.58 L): it prices for elastic demand, so it leaves margin on the table when demand turns out to be inelastic.

**What to watch.** The worst case for v5 is "several wrong at once": ₹7.01 L against ₹−8.74 L for v4, with a worst-10% average of ₹−1.37 L.

**Caveats.** The worlds are synthetic stress tests of the method, not forecasts. The check runs in about 3–6 s (11 re-optimisations).

### Supplier-integration priorities

**What it does.** The PS says the plan should feed supplier integration as well as pre-buy and pricing. `src/lib/supplier-priority.ts` turns the demand a plan leaves unserved into a ranked list, shown on the coverage page. It works for both engines.

**What each row shows:**
- expected unserved units;
- strong-season (P90) unserved units, to size a new connection;
- booking value unserved (expected unserved units × selling price);
- units committed against units offered;
- a next step, with the reason and the current channel.

**The next step** is one of:
- *Refresh supplier quote*: the quote has expired.
- *Negotiate more units*: the plan takes everything the supplier offers.
- *Extend allotment*: the allotment is fully used.
- *Connect free-sale / API supply*: committing does not pay.
- *Top up with free-sale*: the budget or risk stops further commitment.

**Demo results:**
- At ₹50 L, ₹22.9 L of booking value stays unserved across the 8 products.
- The top three are Dubai city hotels (34 room-nights expected, 75 in a strong season, ₹4.0 L), Mumbai → Singapore (18 / 40 seats, ₹4.0 L) and Delhi → Dubai (21 / 48 seats, ₹3.9 L).
- All eight are "Top up with free-sale", because the budget, not supplier capacity, limits the plan.
- At ₹20 L, the v4 plan leaves both flight routes at zero units, so they show "Connect free-sale / API supply" (₹17.1 L and ₹15.6 L of booking value unserved).

## Large portfolios: decomposition solver and background planning

TBO plans across thousands of hotel and flight products, so the planner has to scale well beyond a demo portfolio.

**Why a second solver.** The local search above re-scores every product at every greedy step and moves budget between pairs of products. That is O(n²·S) per pass: 0.9 s at 20 products, 9 s at 40 and 23 s at 80. The decomposition solver (`solveLarge` in `src/lib/risk-optimizer.ts`) scales. It also found better plans in all 15 head-to-head cases below, so it is now the default for every portfolio size.

**How it works.** CVaR is the minimum, over scenario weightings ω, of the ω-weighted expected profit. Each weighting gives a season (1 − r)/S, plus up to r/k extra for the worst seasons. So, for any fixed ω, the problem splits by product once the budget is priced with a multiplier λ:

    λ·B + Σᵢ max over (price, pre-paid units, allotment units) of [ Σₛ ωₛ·profitᵢ,ₛ − λ·costᵢ ]

Each product's maximum is found exactly on two one-dimensional concave curves: one over all units, and one over the unit type that sells first. That takes O(log capacity) steps per price. The solver then repeats three steps:

1. **Bisect λ** so that the plan spends the budget. Each product picks its price together with λ. (Choosing prices separately oscillates: higher prices need fewer units, which lowers λ, which favours lower prices again.)
2. **Update the weights.** It averages the CVaR weighting of each new plan into ω (fictitious play).
3. **Keep the best plan.** It keeps the plan with the best true objective, then improves it in up to three ways:
   - **Unit swaps:** budget-neutral swaps between products, including compound moves such as one expensive unit for two cheaper ones.
   - **Price polish (up to 100 products):** neighbouring prices, each with an exact re-optimisation of that product's units. A price can walk up to three rounds along its grid.
   - **Full pass (up to 16 products, only while the plan is not yet certified within 0.05%):** the local search's improvement pass and its price pass, which re-spends any budget a price change frees.

**Proof of quality.** For any valid ω, the decomposition value is an upper bound on the best achievable objective (weak duality). So every run reports a certified gap, as the local search does. The bound uses the CVaR weighting of the chosen plan and covers every price the plan may use. Tests (`tests/risk-large.test.ts`) check four things:
- the curves against the scenario profits for every price;
- the per-product search against brute force;
- the bound against exhaustive enumeration;
- determinism.

**Measured.** Setup: synthetic portfolios (`src/lib/synthetic-portfolio.ts`, invented numbers), a budget of 35% of full-capacity cost, risk 0.35, Node 20, one core.

| Products | Time | Certified gap | Memory (RSS) |
|---:|---:|---:|---:|
| 20 | 0.3–0.6 s | 0.02% | ≈100 MB |
| 200 | 1.3 s | 0.02% | 131 MB |
| 500 | 1.8 s | 0.02% | 158 MB |
| 1,000 | 3.7 s | 0.01% | 180 MB |
| 2,000 | 7.2 s | 0.02% | 264 MB |

Up to 30 products, the solver also runs a fixed-price pass first and starts from its answer. This is why 20 products takes longer per product than 200, and it guarantees that joint pricing never returns a worse plan than fixed pricing.

**Head to head with the local search** (same scenarios; 15 cases: the demo at ₹50 L and ₹30 L, and synthetic portfolios of 12, 20 and 30 products, each at r = 0, 0.35 and 0.8):
- **Plan quality:** the decomposition's plan was better in all 15 cases, by 0.04–2.3% on the objective.
- **Certificates:** its certified gaps were tighter, 0.003–0.46% against 0.11–2.3%.
- **Speed:** it was faster in all 15 cases. On the demo it took 0.15–0.3 s against 0.25–1.5 s; at 30 products, under 1.1 s against 4–10 s.
- **Not always ahead.** On the public-data portfolio at ₹60 L, the local search's plan is 0.015% better. Both plans are certified within 0.02% of the bound, and the decomposition stops once it is within 0.05%. `solver: "local-search"` reproduces the earlier engine exactly.

**Against the exact optimum:** 30 two-product instances (15–39 units each, some with allotments and minimum orders), solved exactly by enumerating every price, pre-paid and allotment choice. This is the PS harness's D3 check.
- **Decomposition:** at most 0.84% below the optimum, 0.05% on average. The worst case is a move neither solver makes: start buying a product at a higher price while dropping units of the other.
- **Local search:** at most 3.2% below, 0.17% on average.
- **Bounds:** both solvers' upper bounds were valid in every case.

**Background planning.** In the workspace, portfolios above 30 products are planned in a Web Worker (`src/lib/plan-worker.ts`, `src/lib/use-background-plan.ts`), so the page stays usable.
- **Browser test (`qa` smoke, development build):** 1,000 products took 3.0–3.6 s. During planning, frames stayed under 100 ms.
- **Result arrival:** decoding the result takes about 20 ms. Rendering it takes about 0.7 s in the React development build; this has not been measured in a production build here.
- **Changing inputs:** a new budget or risk setting cancels the plan in progress. The previous plan stays on screen, marked as out of date, until the new one arrives.
- **Display:** the overview shows the top 50 rows, with more on request; the CSV export has every row.
- **Try it:** the *Inventory data* page has a "1,000-product test" button (invented numbers).

**Limits** (`src/lib/input-limits.ts`):
- 2,000 products per CSV file, API request or saved plan.
- 5,000 units per product and 500,000 in total, which bounds solver memory.
- A 4 MB API body (Vercel's limit is 4.5 MB).

The legacy `scenario-grid-v4` engine is O(n²) in its greedy fallback: about 2 s at 100 products, 39 s at 500 and 161 s at 1,000. So v4, and the model-risk check that compares against it, accept at most 100 products. Above that, the API defaults to `risk-cvar-v5` and the workspace disables v4. With fixed pricing (`jointPricing: false`), the decomposition keeps each product's reference price; the local search uses a stand-alone price per product.

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
- `tests/risk-v5-extensions.test.ts` (8 tests):
  - **Joint pricing:** exhaustive check over every price and quantity combination, and fixed pricing never beats joint pricing.
  - **Availability target:** met, not-binding and out-of-reach cases; costs are consistent with the plans; the budget is a hard limit; rows carry the target.
  - **What-if re-plans** keep the plan's target.
  - **Scenario overrides** scale demand and prices exactly, keeping common random numbers, and invalid correlation weights are rejected.
  - **Model-risk check:** the "as planned" world matches the risk panel with zero regret; v5 is ahead in every world on the demo; it matches a direct evaluation.
  - **Supplier priorities:** ranking and the choice of next step, including the capacity-bound and expired-quote cases.
  - **API:** validation of `serviceTarget`, `jointPricing` and `modelRisk`, and the shape of the response.
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

- **Pricing.** Prices are chosen jointly with quantities from 13 candidates (the reference price ±15% in 2.5% steps). Demand responds with each product's own elasticity: supplied, learned from price history, or the Lerner-implied prior (see `src/lib/learned-demand.ts`). Cross-product substitution is not modelled.
- **Availability target.** The target is enforced on the planning seasons and covers modelled demand only. It does not include free-sale bookings made outside the plan.
- **Supplier priorities.** The list ranks by gross booking value. It does not include the cost of integrating a supplier or free-sale margins.
- **Allotments.** Release has a single cut-off. Contracts with free release or partial release penalties need extra terms.
- **Scope.** Shocks are scenario assumptions, not forecasts of specific events. Plans take up to 2,000 products (5,000 units each, 500,000 in total); see *Large portfolios* below.

## API

```http
POST /api/procurement/plan
{"items":[...], "budget":5000000, "risk":0.35, "asOf":"2026-11-16", "engine":"risk-cvar-v5", "serviceTarget":0.9, "modelRisk":true}
```

- `engine` is optional. It defaults to `scenario-grid-v4` for up to 100 items and to `risk-cvar-v5` above (v4 does not scale); any other value returns 400. `scenario-grid-v4` and `modelRisk` accept at most 100 items.
- Limits: 1–2,000 items, 5,000 units of capacity per item and 500,000 in total, at most 120 history months per item, and a 4 MB request body (413 above). 1,000 items take about 4–6 s.
- With v5, `summary` adds `cvar10`, `lossProbability`, `demandServedShare`, `demandServedShareBefore`, `prepaidUnits` and `allotmentUnits`.
- `optimization.risk` carries the full risk summary, including the profit histogram.
- `serviceTarget` (v5 only; 0–0.99) sets an availability target. `optimization.service` reports its status, the served share with and without the target, the implied value per booking and the profit and CVaR costs.
- `jointPricing` (v5 only; default `true`) can switch off the joint price search. `optimization.pricing` says which mode ran.
- `modelRisk: true` (v5 only) adds the mismatched-world report as `modelRisk` (about 3–5 s).
- Sending any of these three options without `engine: "risk-cvar-v5"` returns 400.
- `model` reports the engine (with `-experimental-blend` when a fitted blend is applied).
- Saved private plans record the model version. Projects created before v5 must apply [`docs/security/allow-risk-cvar-v5.sql`](../../docs/security/allow-risk-cvar-v5.sql) before v5 plans can be saved.
