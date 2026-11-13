# TBO Inventory Intelligence

A decision-support prototype for the attached TBO travel-inventory optimization challenge. The existing group-travel app and its routes remain in the repository; its original documentation is in [README-legacy.md](README-legacy.md). The original TBO Assemble homepage is restored at `/`; the inventory intelligence demo is available at `/inventory`.

## Run locally

Requires Node 20.9+.

```sh
npm ci
npm run dev
```

Open http://localhost:3000 for the original homepage or http://localhost:3000/inventory for the inventory demo. The new demo does not require a database, Supabase, Vercel or API keys; its live-data panels require outbound internet access. Legacy routes may require their original configuration.

## What works

- Synthetic hotel and flight product-period inputs with bookings, search conversion, seasonality, cancellations, hypothetical market signals, sold-out context and supplier capacity.
- Editable budget and risk appetite, whole-unit allocation respecting the budget and capacity, and a five-price search.
- Low/base/high demand scenarios, expected and low-scenario profit, opportunity details, type/period filters and CSV export.
- Search-discovered research catalogs and method notes in [docs/research](docs/research/README.md).

Run the decision engine invariants with `npx tsx tests/procurement.test.ts`.

## Important limitations

Demo inventory inputs are synthetic, and forecasts are heuristic even when using imported data; there are no live TBO or supplier integrations. The separate destination-attention and holiday panels call live third-party APIs. The forecasting weights, volatility, elasticity and scenario probabilities are assumptions, not learned or backtested. The allocation is a greedy heuristic, not a guaranteed global optimum. Sold-out contributes an arbitrary uplift, not a validated correction for censored demand. Supplier strategy and purchase timing are simple, transparent rules based on the loaded inputs, not a trained timing model or a supplier integration. This is not production investment advice or an automated purchasing system. See [research and methodology](docs/research/README.md) for formulas, evidence and next steps.

## Production build note

The legacy API routes require `DATABASE_URL` at build time, even though the inventory demo does not use the database. A webpack build was verified with a placeholder PostgreSQL URL; legacy database-backed routes still require a real configured database at runtime. The inherited dependency tree currently reports security vulnerabilities; audit and remediate it before production use.

## Real inputs and external APIs

The CSV import accepts inventory inputs and runs the existing optimizer on them in the browser. Download the sample template and see [the field guide](public/research/inventory-input.md). Files are validated and remain local unless the user explicitly invokes the planning API; the API does not persist them. There is no persistence. This model still uses heuristic assumptions and is not backtested or investment-ready, even with real data.

- `GET /api/market/demand?destination=Goa` calls the Wikimedia Pageviews API for 14 consecutive days of public attention to a destination's English Wikipedia article and compares the latest seven days with the previous seven. It is **not** travel searches, look-to-book, bookings, inventory availability or a validated demand forecast. News and unrelated events can influence pageviews.
- `GET /api/market/holidays?country=SG&year=2027` calls Nager.Date for country public holidays. Supports SG, ID, IN, AE and TH queries and years 2000–2099; coverage varies. A 204 response is treated as missing/unknown coverage, never as proof there are no holidays. Date, regional scope, source and retrieval time are shown; verify with local authorities.

Both routes use fixed allowlists and timeouts. No keys are required. The client supports refresh, loading and failure states, and never substitutes demo data when calls fail. These external signals do not automatically change the forecast. No live TBO or supplier integration exists; provider access and contract terms are needed to obtain actual booking, search and availability data. Review provider terms and limits before deployment.

With the dev server running, check the APIs with `node tests/market-api.test.mjs`; this test needs outbound network access.

## Planning and procurement decisions

The dashboard calculates demand from imported historical bookings and look-to-book estimates, seasonality, cancellation assumptions, stockouts and user-entered market factors. Existing sellable stock is subtracted from price-adjusted forecast demand. Five candidate selling prices and low/base/high demand scenarios feed a discrete greedy budget allocator; optional recovery reduces the cost of unsold stock. The allocator respects each supplier capacity, excludes quotes expired on the chosen review date, and never spends beyond budget. It is not a globally optimal solver.

Quote expiry and previous price provide transparent timing flags. Strategy suggestions (pre-buy, flexible terms, or monitor/integrate) are rules using the selected quantity, sell-through and downside; they do not connect to suppliers or execute bookings. See the [input guide](public/research/inventory-input.md) for definitions and caveats.

The optional `POST /api/procurement/plan` route accepts JSON `{items, budget, risk, asOf}` using the same fields as the CSV and returns the recommendations and summary. The dashboard’s **Run planning API** button explicitly sends the current inputs to the application server. The route does not place orders or persist data. Protect this endpoint with authentication, rate limiting, access controls and audit logging before production use.

## Flight demand and fare intelligence

Open `/flight-intelligence`. It offers an optional Travelpayouts cached-fare comparison for two departure dates, Google News RSS destination headlines and Open-Meteo weather, a local historical CSV upload and a simple leakage-safe daily route-level booking and fare baseline with rolling MAE. News and provider offers are displayed as context, not used as features in the baseline. Booking-day forecasts aggregate the historical travel-date mix and are not predictions for a particular departure date. Travelpayouts cached-fare data needs an optional free-account token and is not a live bookable quote. Open-Meteo free access is non-commercial and provider terms apply. See [flight setup, CSV schema, and limitations](public/research/flight-setup.md).
