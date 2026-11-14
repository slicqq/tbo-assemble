# Inventory CSV field guide

Download the template from the dashboard. Its example row is synthetic. Replace it with your own data; one row represents one hotel-room-night or flight-seat product and travel period. Required column names are case-sensitive. The file is parsed in your browser. Inputs are sent to the server if you explicitly run the planning API or save a plan to your account. The API does not persist inputs; a saved plan does. Import replaces the current in-memory inputs. Reloading the page restores demo data until you open a saved plan. Saved plans contain inputs and are recalculated on reopening; they can be deleted from the saved plans section. Email ownership is currently unverified, so do not upload sensitive data.

| Field | Meaning |
|---|---|
| id | Unique ID per row |
| name | Product or route name |
| destination | Destination label |
| kind | Exactly `Hotel` or `Flight` |
| period | Travel period label, e.g. `Dec 2026` |
| buy | Unit procurement cost in INR; greater than 0 |
| referencePrice | Reference selling price per unit in INR; greater than 0 |
| capacity | Available units; integer 0–500 per row |
| bookings | Historical bookings for a comparable product-period |
| searches | Look/search count for a comparable product-period |
| conversion | Look-to-book ratio as a fraction 0–1 |
| seasonal | Manually estimated seasonal multiplier 0–5; 1 means no change |
| signal | Manually estimated market multiplier 0–5; 1 means no change |
| cancellations | Assumed cancellation fraction 0–1, e.g. 0.12 for 12% |
| volatility | Assumed demand downside/upside fraction 0–1 |
| soldOut | Percent of searches that were sold out, 0–100 |
| integration | Supplier strategy label supplied by you, not an actual integration |
| timing | Purchase timing label supplied by you, not optimized |

Up to 20 rows, total capacity up to 3,000. Model forecasts are unvalidated heuristics and depend on comparable time windows. Price and cost must use the same unit and currency. Ensure you have rights to use the data and review your organization's handling rules before import. CSV files with quoted commas and quotes are supported. The pageviews and holiday APIs are external context only and do not automatically modify your inputs.

## Optional columns

The template includes these optional inputs; older templates without them still work.

- `existingStock`: unsold, sellable units already available for the same product and period. The model subtracts these from projected demand before recommending new purchases. Do not include already sold units.
- `recoveryPct`: fraction (0–1) of the purchase cost recovered on unsold units, e.g. 0.2. Defaults to 0. This is a modeling assumption, not a guaranteed refund.
- `previousBuy`: previous comparable supplier unit quote in INR. Together with the current quote it supports a simple price-change flag.
- `quoteExpiry`: quote expiry in YYYY-MM-DD. Quotes expired before the chosen review date are excluded from new purchases. The app flags quotes expiring within seven days; otherwise it may suggest monitoring or negotiating if the price rose >10%.

The strategy suggestion is a simple decision rule, not a supplier integration or guaranteed optimum. `integration` and `timing` remain required for compatibility with earlier templates, but `timing` is no longer used to recommend purchase timing. The `integration` value is displayed only as a user-supplied supplier label. You must verify all contract terms.

- `previousBookings` and `previousSearches`: previous comparable period's totals, used to derive booking/search trends. When each prior value is positive, the model applies 30% of relative booking change and 20% of relative search change, combined and capped at −20% to +20%. A blank or zero prior value adds no trend adjustment. The coefficients are assumptions, not trained estimates.
