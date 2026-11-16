# Singapore hotel demand: reproducible public-data study

## Source and license
Contains information from **Hotel Statistics, Monthly**, Singapore Department of Statistics (SINGSTAT), source Singapore Tourism Board, accessed **2026-11-15 UTC according to the capture machine's clock**, made available under the [Singapore Open Data Licence v1.0](https://data.gov.sg/open-data-licence). [Official dataset](https://data.gov.sg/datasets/d_8e62605f0c1c948702b6ea0fe45242d3/view). Its page reported an update on 2026-11-10. A discrepancy was observed between the capture-machine clock and the conversation's stated date; the source capture time has not been independently established. The display refuses a current forecast if the snapshot access/update timestamp is in the future relative to the viewer's clock. The snapshot remains available for retrospective research. Do not backdate its acquisition.

The checked-in source CSV `data/singapore-hotel-statistics-2026-11.csv` has SHA-256 `1c66fdf7e8b49fafeb1287b010fd8a40bc3aa521e44a0800d7d33e623021d6a3`. `python3 scripts/prepare_singapore_hotels.py` verifies the hash, extracts the `Gross Lettings` series and rebuilds the JSON. Pinned monthly observations cover January 2008–September 2026. This is a static, manually updated snapshot: it does not silently refresh. To update it, verify the official source, record the actual access/update time, hash, coverage, revisions and license, and deliberately update the script and tests. Freshness is checked at display time.

The series measures occupied room-nights (gross lettings, including paid and complimentary lettings) at gazetted Singapore hotels, not reservations, customer-level TBO demand, Indian domestic travel, a single hotel, room inventory available to a buyer, or unconstrained demand. Occupancy and supply changes can limit observed sales; no available rooms, prices, bookings, cancellations, search or stockout features are used in this model. This series is not transferred to the procurement allocator. The learned model tested here is, however, the model the planner uses for any product that carries a monthly history; see `public-data-portfolio.md`.

## Forecast question and chronology
Predict a target calendar month's total gross lettings using only values from the same month a year before and the month three months before the target. For example, a December target uses the preceding September and previous December values. This assumes the observation from three months before the target has been released by the beginning of the target month. Actual historical publication dates and original vintages were not archived; **the current file may include later revisions**. Consequently this replay is not a verified point-in-time backtest and may contain revision or availability leakage. Acquire original release vintages before calling it leakage-free.

The fixed protocol uses:

1. **Train:** 24 target months, Jan 2022–Dec 2023. Select a blend weight from 0%, 5%, …, 100% to minimize MAE; prediction = weight × same month last year + (1 − weight) × three-month lag. Ties choose the lower weight. The blend is fixed after training.
2. **Second candidate (added Nov 2026): the planner's learned seasonal model** (`src/lib/learned-demand.ts`, `rollingForecasts`). It has no tuned parameters. For every target it is refitted on data up to three months before the target: log demand on month-of-year effects and a trend, Huber-weighted, on the latest 48 usable months. Projection uses the median year-on-year change of the latest 12 months, anchored on the median deseasonalised level of the latest three months. COVID months (Feb 2020 – Mar 2022, until Singapore reopened to vaccinated travellers on 1 Apr 2022) are left out of the fit.
3. **Validation:** 21 later months, Jan 2024–Sep 2025. Select the fallback baseline solely by validation MAE, with seasonal winning ties. **Select the candidate (blend or learned model) solely by validation MAE.** Calculate candidate and baseline errors.
4. **Holdout:** 12 later months, Oct 2025–Sep 2026. Both baselines and the fixed candidate are evaluated. The candidate may be displayed only if its MAE is more than 5% lower than **both** baselines in **both** validation and holdout. Otherwise display the validation-selected baseline. The holdout results were inspected during development before the full display protocol was finalized, and this gate uses those outcomes to decide which method to display. Thus this is not an untouched independent final test, even though the candidate is fitted only on earlier training data; future prospective testing is required. The 5% margin is a product rule, not a significance test.

Each target uses its three-month lag and twelve-month lag; earlier holdout outcomes may be used as inputs only after the assumed lag. There is no fit to the holdout. All source values are from the later revised snapshot, and release timing is an unverified assumption. No Trends data or current booking observations are used.

### Result (snapshot of 2026-11-15)

| Method | Validation MAE (Jan 2024–Sep 2025) | Holdout MAE (Oct 2025–Sep 2026) |
|---|---:|---:|
| Same month last year | 105,186 | 61,435 |
| Three-month lag | 130,965 | 136,096 |
| Fitted blend (weight 0 = three-month lag) | 130,965 | 136,096 |
| **Learned seasonal model** | **59,727** | **45,392** |

- **Blend:** its weight is fitted on 2022–23, Singapore's reopening years, where the three-month lag beats "same month last year". The weight is therefore 0, and the blend fails in normal years.
- **Learned model:** chosen on validation. It beats both baselines by more than 5% in both periods (−43% and −26% against the better baseline), so it passes the unchanged rule and is displayed.
- **Range:** the radius is 88,272 room-nights and covers 11 of the 12 holdout months.
- **December 2026 forecast** (as of 16 Nov 2026): 1,542,550 room-nights (range 1,454,278–1,630,821).

`tests/singapore-demand.test.ts` checks that a target's learned forecast does not change when the two latest months change but does change with the month three months back (lag 3).

## Ranges and current forecast
For the displayed method, calculate absolute validation errors, sort them, and use the `ceil((n + 1) × 0.8)` order statistic (18th of 21) as a symmetric radius, clipped at zero. Report descriptive coverage on the same 12 holdout months. Error dependence, nonstationarity, chosen method, revision leakage, a small calibration sample, and selection on validation/holdout mean this is **not a calibrated guarantee**. Do not convert it to an interval for a product or purchase.

A current forecast is only shown for the next calendar month when the source access and update timestamps are not in the future according to the viewer's clock, the latest data include the required three-month lag and that lag's matching prior-year value, and the latest observation is before the current month. A static snapshot goes stale; do not assume new data is automatically fetched. The as-of check cannot verify the viewer's clock or actual source release time. The chart and results are historical examples, not live decisions or evidence of profit.

## Reproduce
Install dependencies, then run `python3 scripts/prepare_singapore_hotels.py` and `npx tsx --test tests/singapore-demand.test.ts`. The existing hardcoded research split and static input mean this is one historical experiment; future dated outcomes must be assessed separately. Follow source's license and attribution requirements and do not suggest government endorsement.
