# Directional Indian passenger traffic: retrospective validation

This research test uses the same DGCA-derived city-pair data as [India Travel Data](india-market-data.md), served by `/api/india-market/traffic`. The upstream database is [Vonter/india-aviation-traffic](https://github.com/Vonter/india-aviation-traffic), licensed ODbL 1.0; see that project's licence and attribution requirements. These are *industry-wide passengers carried*, not TBO searches or bookings, purchasable seats, airfares or hotel demand. No results feed the procurement allocator. This is not a commercially validated forecasting system.

## Rules and timing

The target is total passengers for one calendar month in one directional city pair. A target month `t` uses only records for `t−2` or earlier: it assumes the final totals for `t−2` became available by the month before `t`, a one-month reporting delay. This is an **assumption**, not verified historical publication timing. Actual release delays may be longer, and the source may contain revisions that were not known at that historical date. Therefore these results are retrospective and potentially optimistic. Values from target month or later are never used in that target's forecast. Missing, invalid, conflicting or duplicate monthly records are excluded, not interpreted as zeros.

Three fixed rules are considered:

1. **Last observed:** use `t−2` passengers.
2. **Last year:** use `t−12` passengers.
3. **Seasonal ratio:** multiply `t−2` by `t−12 / t−14`, with the seasonal ratio limited to 0.5–2.0. This requires a positive `t−14` value.

For each target, evaluate those rules on the 12 earlier completed target months from `t−13` to `t−2`. Each replay itself can use only data up to its own `t−2`. Compare the rules on the same months with all three predictions present; choose the lowest mean absolute error (MAE) if at least eight comparable examples exist. Otherwise fall back to last year, or last observed if the year is missing. This selection rule is applied separately for every historical target; no aggregate holdout outcomes are used to tune its parameters.

## Fixed retrospective comparison and display gate

The app tests January 2024 through December 2025. The model was designed after examining the source, so this is not an untouched holdout. It reports MAE for the adaptive procedure and both baseline rules on the same target months. Missing months are omitted. At least 12 matched outcomes must exist. For a current experimental estimate to be displayed, the adaptive MAE must be **more than 5% lower than both** baselines, at least eight prior replay examples must be available for the current choice, and the latest usable source month must be exactly the month before the current UTC month. The forecast target is two months after that latest observation, strictly in the future. Otherwise the current estimate is withheld; the historical benchmark comparison is still shown. This strict gate is a conservative product rule, not a statistical guarantee or prospective validation.

Tests use the modern retrieved CSV, not archived month-by-month publication snapshots. Input data, the model rules, the fixed 2024–25 period and gate were chosen for a prototype; future performance is unknown. Even a passing route is not evidence of accuracy for other routes, periods, prices or TBO. Passenger totals can be constrained by available capacity and cannot identify unmet demand, cancellations or search-to-book conversion. There is no predicted uncertainty range. Do not substitute these figures for net inventory demand or treat them as evidence that a supplier has seats.

## Reproduction

`studyTraffic` in `src/lib/india-traffic-forecast.ts` implements the replay and gate. Synthetic tests in `tests/india-traffic-forecast.test.ts` check temporal isolation, common-baseline comparison, missing/duplicate handling, benchmark failure and freshness withholding. Live values depend on the source CSV at retrieval time and may change after revisions. Every display includes the source retrieval time on the traffic chart.
