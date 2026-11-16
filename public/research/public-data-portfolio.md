# Public-data portfolio: the planner on real demand histories

**Where:** Inventory → Data → **Use public data** (or `publicPortfolio()` in `src/lib/public-portfolio.ts`; the plan API accepts the same items).

The demo inventory uses typed inputs. This portfolio shows the planner on **real monthly demand histories** instead: eight hotels and routes whose history is public traffic data from 2016 to 2026. The planner learns season and growth from each series and checks its forecast against "same month last year" before using it (`src/lib/learned-demand.ts`).

## Sources

| Source | What it measures | Months | Snapshot |
|---|---|---|---|
| DGCA domestic city-pair traffic, aggregated by [Vonter/india-aviation-traffic](https://github.com/Vonter/india-aviation-traffic) ([file](https://raw.githubusercontent.com/Vonter/india-aviation-traffic/main/aggregated/domestic/city.csv)) | Monthly passengers per direction between Indian cities | Apr 2015 – Jul 2026 | sha256 `6be5b6dfc4e163e5…` |
| Singapore Tourism Board via [data.gov.sg](https://data.gov.sg/datasets/d_8e62605f0c1c948702b6ea0fe45242d3/view) | Occupied hotel room nights, all of Singapore | Jan 2008 – Sep 2026 | sha256 `1c66fdf7e8b49faf…` (`src/data/singapore-gross-lettings.json`) |

The snapshot `src/data/public-portfolio.json` is rebuilt by `python3 docs/data/build_public_portfolio.py`, which downloads the DGCA file and records its hash.

**How the series are built**
- **Routes:** passengers in one direction (e.g. Delhi → Mumbai).
- **Leisure hotels:** air arrivals into the city (all routes) stand in for hotel demand there. This proxy is reasonable for air-dependent destinations such as Goa, Srinagar and Kochi.
- **City names:** normalised before summing (Goa = Dabolim + Mopa from 2023; Mumbai includes Navi Mumbai; Cochin = Kochi).
- **Gaps:** the DGCA file has no rows for May 2021 and May 2024. Those months are imputed as last year × the neighbouring year-on-year ratios and flagged.

## What is real and what is assumed

- **Real:** the shape of demand, meaning seasonality, growth, shocks and month-to-month noise.
- **Scaled:** each series is scaled to a product-sized level (e.g. 140 room nights a month for Goa). The model is log-linear, so scaling changes none of the learned season, growth, error spread or backtest result.
- **Assumed (illustrative):** buy costs, selling prices, capacity, allotment terms and cancellation rates. They are not TBO data.
- **Market-level series:** a market is smoother than one product. These items set `historyScope: 'market'`, and the risk engine uses the larger of the learned error spread and the product's typed volatility.

## Shock months are excluded from fitting and validation

COVID-19 months stay in the series but are flagged `exclude`. They are not used to fit the model, are not scored in the backtest, and seasonal-naive skips them:
- **DGCA:** Mar 2020 – Feb 2022. National lockdown from 25 Mar 2020; domestic flights resumed 25 May 2020 under capacity caps (lifted 18 Oct 2021); Omicron wave in Jan–Feb 2022.
- **Singapore:** Feb 2020 – Mar 2022. The country reopened to vaccinated travellers on 1 Apr 2022.

This exclusion matters: fitted naively, two crushed Mays (2020 and 2021) produce a May seasonal index of 0.13, and dividing May 2023 by it inflates the forecast level several-fold. The unit test `tests/public-portfolio.test.ts` checks that fewer series pass the gate when the flags are removed.

## Validation: learned model vs same month last year

The model is refitted at every rolling origin using only data available then. It forecasts the same horizon as the real decision, and the score covers the latest 36 origins (three years). The learned forecast is used only if it beats seasonal-naive by more than 5% MAE; otherwise the planner uses seasonal-naive. Units are product-scaled room nights or seats per month.

| Product | History (public series) | Target | Folds | MAE learned / same-month-last-year | Skill | Used | Forecast (gross) | 80% band |
|---|---|---|---:|---:|---:|---|---:|---|
| Goa beach hotels | DGCA air arrivals into Goa | Dec 2026 (h = 5) | 35 | 9.3 / 11.0 | 15% | Learned model | 149 | ×0.90–×1.02 |
| Jaipur heritage hotels | DGCA air arrivals into Jaipur | Jan 2027 (h = 6) | 35 | 7.4 / 9.0 | 17% | Learned model | 90 | ×0.83–×1.08 |
| Kerala backwater resorts | DGCA air arrivals into Kochi | Dec 2026 (h = 5) | 35 | 6.2 / 5.2 | −21% | Same month last year | 88 | ×0.96–×1.13 |
| Srinagar hotels and houseboats | DGCA air arrivals into Srinagar | May 2027 (h = 10) | 35 | 13.7 / 12.8 | −7% | Same month last year | 92 | ×0.75–×1.12 |
| Singapore city hotels | Singapore Tourism Board occupied room nights | Dec 2026 (h = 3) | 36 | 3.8 / 6.0 | 36% | Learned model | 103 | ×0.94–×1.04 |
| Delhi → Mumbai | DGCA passengers Delhi → Mumbai | Dec 2026 (h = 5) | 35 | 7.2 / 9.2 | 22% | Learned model | 138 | ×0.90–×1.10 |
| Bengaluru → Delhi | DGCA passengers Bengaluru → Delhi | Jan 2027 (h = 6) | 35 | 6.5 / 6.4 | −1% | Same month last year | 102 | ×0.91–×1.15 |
| Delhi → Goa | DGCA passengers Delhi → Goa | Dec 2026 (h = 5) | 35 | 8.6 / 9.9 | 13% | Learned model | 110 | ×0.84–×1.14 |

**Results**
- Five of eight series pass the gate, beating "same month last year" by 13–36% MAE. The other three fall back to it, exactly as designed. A model that cannot beat the naive benchmark is not used.
- Goa's December index (about ×1.4 over the July monsoon month) is learned from the data, not typed.
- The planner's demand for each product is this validated forecast × (1 − cancellations).

**Plan on this portfolio** (risk-cvar-v5, risk 0.35, as of 16 Nov 2026, cash budget basis)

| Budget | What the plan does |
|---|---|
| ₹25 L | Spends the full budget and prices 2.5–7.5% above market. Supply is scarce, so a small mark-up rations it to the most profitable demand. |
| ₹40 L | Spends ₹39.98 L, all at market prices: 465 prepaid and 188 allotment units, 81% of demand served, expected profit ₹13.3 L, CVaR10 ₹7.1 L, P(loss) 0.6%. |
| ₹60 L | Stops at about ₹40.7 L. Beyond that, extra units lower the risk-adjusted objective, so the rest of the budget is left unspent. |

## Is the "80%" demand range honest?

The planner's 80% range for each product is built from the 10th and 90th percentiles of its rolling forecast errors (`band80` in `learned-demand.ts`). `tests/forecast-calibration.test.ts` checks it out of sample (sequential split-conformal):
- For each of the latest 24 forecasts, the range is built only from errors already known at that forecast's origin (latest 36).
- The test then records whether the actual landed inside.
- It runs on 15 real series: this portfolio, Singapore room nights (3 months ahead) and the six DGCA study routes (2 months ahead).

| Result | Value |
|---|---|
| Pooled coverage | **293 of 360 forecasts = 81.4%** (target 80%) |
| Typical range width | ±9–23% of the forecast |
| Using the textbook conformal order statistic instead | over-covers (88%), so the interpolated percentile is kept |
| Exception | Srinagar (11/24): air arrivals fell from 218k in May 2024 to 79k in May 2025 and stayed below 2024 levels into 2026. A range built on past errors cannot anticipate a shock like that; for Srinagar the planner falls back to "same month last year", which follows the new level. |

## Limits

- **Proxies:** air passengers and city-wide room nights stand in for one product's bookings. With TBO booking history per HotelCode or route, the same code learns from the product itself (`historyScope: 'product'`) and uses its own error spread.
- **Signals:** no external signal or price history is attached to these series. Signal and price effects are learned only when a history carries `signal` or `price` columns.
- **Data lag:** DGCA data lags by about four months (last month Jul 2026), so the December forecast is five months ahead.
