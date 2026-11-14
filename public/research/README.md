# Inventory intelligence: research and implementation notes

## Scope and evidence quality

The accompanying catalogs contain **239 candidate scholarly articles** and **231 candidate public GitHub repositories**, retrieved on 13 November 2026 via OpenAlex and GitHub's search APIs. Six topical searches per source cover hotel forecasting, revenue management, tourism demand, stochastic inventory and cancellations. Duplicates were removed by OpenAlex ID or GitHub full name. The query used for each result is recorded; the collection script is included. These are **search-discovered candidates, not 470 individually read, validated or endorsed sources**. Search results can include tangential work; publication status, full texts, data quality, repository functionality, maintenance, licensing and relevance need individual review. "Foreign" is interpreted as external to the original project; authors' or maintainers' nationality/location was not verified. Stars and timestamps are snapshots, not recommendations. Do not reuse code without checking its license.

- [Candidate articles (CSV)](papers.csv) — title, year, authors, DOI/OpenAlex link, query and citation count.
- [Candidate repositories (CSV)](repositories.csv) — description, URL, stars, license metadata, updated date and query.
- [Collection script](collect.py) — API-based discovery; rerunning requires Python requests and network access. Repository CSV is preserved if already present.

## Selected evidence and what is applied

1. António, de Almeida and Nunes, *Predicting hotel booking cancellations to decrease uncertainty and increase revenue* (2017), [doi:10.18089/tms.2017.13203](https://doi.org/10.18089/tms.2017.13203). Cancellations affect net demand. **Applied:** demo demand is adjusted for an assumed cancellation rate exactly once; this is not the paper's trained model.
2. Huang and Zheng, *Hotel demand forecasting: a comprehensive literature review* (2022), [doi:10.1108/TR-07-2022-0367](https://doi.org/10.1108/TR-07-2022-0367). **Applied in simplified form:** blend booking and search signals with seasonality. The demo is a heuristic, not a reproduction or evaluated forecast.
3. [TravelPulse](https://github.com/manish-chaudhary1/TRAVELPULSE) describes procurement optimization with demand, budget, supplier capacity and scenario analysis. **Applied in simplified form:** scenario-based payoffs and discrete budget/capacity constraints. Unlike its described LP, this app compares a rounded budget-grid search with a greedy fallback and reports a model-only upper bound; it does not claim real-world or exact global optimality.
4. [Sali-analytics/hotel-demand-forecasting](https://github.com/Sali-analytics/hotel-demand-forecasting) describes forecasting with historical demand, seasonality and cancellation analysis. **Applied:** the dashboard exposes a synthetic historical demand/search trend and cancellation assumption; no Prophet model is included.
5. [saur0608/Hotel-Demand](https://github.com/saur0608/Hotel-Demand) describes booking-pace features and rolling backtests. **Partly applied:** a browser-only chronological holdout can compare user-supplied product snapshots with a prior-period baseline; the app does not ingest verified booking ledgers or automatically deploy the fitted blend. Rolling-origin evaluation on representative data is still required.

These are method inspirations, not claims that every candidate source was read or that its findings were reproduced. All calculations were written for this prototype; external repository code was not copied.

## Calculation and limitations

For each product-period, illustrative net demand = (0.55 × historical bookings + 0.45 × searches × look-to-book conversion) × optional capped historical-trend factor × seasonal factor × external-signal factor × (1 + 0.2 × sold-out rate) × (1 − cancellation rate). The external signal is an invented input, not a live feed. For each of five candidate prices (90–110% of reference), adjusted demand = net demand × (price/reference price)^−1.2. Low/base/high demand have weights 25%/50%/25% and multipliers 1−volatility, 1, 1+volatility. Scenario sales are capped at purchased units; profit is sales × price − units × buy cost. Unsold stock may recover an optional fraction of purchase cost; there is no cancellation refund. Risk-adjusted objective = expected profit − risk weight × (expected profit − low-scenario profit).

Existing sellable stock is subtracted from price-adjusted demand. Optional quote expiry excludes expired inventory from allocation. The allocation engine compares a rounded budget-grid search with a marginal-return greedy fallback and reports a model-only upper bound. It is approximate, not a proven globally optimal allocation. Products are independent; low-scenario profit is the sum of each product's low scenario, a stress scenario rather than a probability-calibrated portfolio VaR. Demand forecasting is point-based with arbitrary scenarios, not a trained or calibrated model. The sold-out uplift is an arbitrary heuristic, not a validated method for correcting censored demand; historical demand can be censored by prior stockouts. Purchase timing and supplier strategies are rule-based suggestions, not trained or connected to suppliers. No fees, refunds, supplier minimums, currency conversion, substitution, contract terms, or working capital timing are modeled. Room nights and seats are treated as independent units.

## Forecast validation

The optional [historical validation guide](demand-validation.md) describes how to compare the current planner and a training-only fitted blend against a prior-period baseline on a chronological holdout. The validation results do not change allocation. User-provided dates and historical data are not verified by the app.

## Production roadmap

- Ingest dated booking, cancellation, look-to-book, sold-out, inventory, contract and price histories; define as-of timestamps to prevent leakage.
- Estimate unconstrained demand and cancellation probabilities by product and lead time; train forecasting baselines and perform rolling backtests by horizon, segment and high-demand periods.
- Validate elasticity and market/event/weather signals out of sample. Calibrate probabilistic forecasts and model correlations between products.
- Use a mixed-integer stochastic optimizer with price choices, budget, supplier contracts, existing stock, multiple currencies, downside/CVaR and supplier capacity. Compare with the heuristic and quantify the optimality gap.
- Model procurement timing from quote history and expiry dates, connect supplier feeds securely, add human approval, audit logs, permissions and monitoring. Never place real orders automatically from this prototype.
