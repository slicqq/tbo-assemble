# Historical demand validation

The workspace includes an optional, browser-only retrospective test. It does **not** change the allocation or make a forecast production-ready. Use no customer-level or sensitive data. The app cannot establish data provenance, check the truth of reported timestamps, or confirm that a product and unit are representative of TBO's current business.

## CSV contract

Download the template from **Validate demand against history**. One file must cover exactly one product or route (`opportunity_id`) and one unit (`room_nights` or `seats`). One row is a snapshot for one non-overlapping future travel period. All periods must have the same length and the snapshot must have the same lead time before each period starts. Use at most 1,000 rows and 500 KB. Do not mix room-nights and booking records, seats and passengers, destinations, price tiers or different travel products. Do not fill missing days with zeros unless zero is observed.

- `as_of`: snapshot date, strictly before `period_start`. All inputs, including prior-period units and any conversion/cancellation estimate, must have been available on that date. Do not use final revised values, future searches, final cancellations, or statistics fitted using later periods.
- `period_start`, `period_end`: inclusive dates for the future travel period. Periods must not overlap or repeat; one snapshot per period.
- `outcome_available_on`: the date the final outcome first became available, on or after period end. It must include any outcome/label delay. Only outcomes available by the evaluation date are included. Later corrections require their true availability date, not a backdated one.
- `bookings`, `previous_bookings`, `searches`, `previous_searches`, `conversion`, `seasonal`, `signal`, `cancellations`, `sold_out`: historical features for this product, with the same definitions as the planner. Fractions for conversion and cancellations are 0–1; sold_out is 0–100. Numbers must be valid at the snapshot date. Sales inputs must be comparable to the target; where a booking spans multiple room-nights, aggregate into room-nights, not booking records.
- `prior_net_units`: actual net units for a comparable **prior completed period** already known at `as_of`. This is the simple baseline. Its selection must be fixed before evaluation, not chosen after seeing each future outcome.
- `actual_net_units`: final net room-nights or seats sold/consumed for the stated future period. Supply-capped sales understate unconstrained demand. Do not interpret sold-out sales as true demand without availability and censoring information.

The single example line in the template demonstrates formatting, not enough data to test. It is synthetic. Use at least 20 usable training observations and 8 completed holdout observations. If labels overlap or arrive late, additional rows may be required.

## Chronological evaluation

The last 25% of completed snapshots (at least eight) are reserved as a chronological holdout; this choice is fixed before evaluating results. Of earlier rows, only those with outcomes available **strictly before** the first holdout snapshot are eligible for training. The rest are purged. At least 20 eligible training rows are required. Outcomes unavailable as of the selected evaluation date are excluded completely.

A simple blend weight is fit using only training data: among 21 fixed candidate weights from 0% to 100%, select the one minimizing training mean absolute error (MAE). Each prediction uses the planner's current fixed trend, seasonal, signal, sold-out and cancellation multipliers, but varies the booking versus search-conversion weight. The pre-existing planner formula uses a fixed 55% bookings and 45% searches × conversion. Both are compared with the prior-period net-unit baseline on the untouched holdout. We show MAE, weighted absolute percentage error (sum absolute errors divided by sum actual, omitted if the denominator is zero), and the last 12 individual holdout predictions. Smaller is better.

This is a single retrospective holdout, not a prospective trial. Non-overlap reduces direct period reuse but does not remove temporal correlation, selection bias, changes in price or stock, evolving suppliers, missingness, or geographic shift. Users may choose or revise datasets after seeing results. Model selection, calibration and input provenance need independent evaluation before operational use. The fitted model is not automatically selected, deployed or used for allocation; it has no estimated uncertainty interval, price elasticity or supplier connection. The existing optimizer and profit calculations remain assumption-driven.
