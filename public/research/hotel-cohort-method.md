# Historical hotel stay-window forecasting experiment

## Purpose and limitations

This experiment is not a forecast of current India, TBO bookings, room-nights or net demand and does not change the procurement allocator. It replays an old public Portuguese hotel dataset and tests whether one trained method can improve on a simple benchmark. Do not use it for investment decisions. No personal records are persisted; the app stores only pre-aggregated counts.

The source is António, de Almeida and Nunes (2019), *Hotel booking demand datasets*, Data in Brief, DOI [10.1016/j.dib.2018.11.126](https://doi.org/10.1016/j.dib.2018.11.126), via the public [TidyTuesday CSV](https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2020/2020-02-11/hotels.csv), SHA-256 `7c2ae42a7353905ea136e5c2287f17c92c5435826598bfbb8491c6f0c7b1fc06`. Article is CC BY 4.0; independently verify source data rights before redistribution or commercial use. `python scripts/prepare_hotel_cohort_data.py` downloads and verifies this file, then regenerates the aggregate.

The source includes bookings for arrivals July 2015–August 2017 and is selected by **arrival date**, not a complete booking-day event log. The booking date is inferred as arrival date minus final reported lead time, which can be affected by subsequent amendments. Historical labels may not have existed in that form at the time of prediction. The source includes gross booking records including eventual cancellations. It does not establish room-nights, availability, sold-out periods, searches or look-to-book. Zero counts are zeros in the restricted extract, not proof of zero real demand. Cancellation timestamps are not sufficient to infer net bookings as of each historical date, so net demand is not modelled. The observations describe just two hotels in Portugal and cannot establish current performance anywhere else.

## Target and features

For each hotel and as-of date, define a stay-arrival window from 30 to 59 days after as-of, inclusive. The target is the count of inferred booking records created on as-of through as-of+6 for **that fixed arrival window**. Features are the counts for the same fixed arrival window in the prior seven days and the prior 21 days (scaled to a seven-day equivalent). Neither uses target-period booking counts. A baseline predicts the next seven-day count equals the previous seven-day count.

## Training and evaluation

A separate ridge linear regression per hotel uses these two features, a fixed penalty of 100 and a fitted intercept. Dates March 1–April 24, 2016 train the model. Last training label ends April 30. May 1–24 is used to select either the trained model or the baseline by mean absolute error (MAE). Last calibration label ends May 30. The June 1–30 holdout reports MAE for both candidates and the selected method; it plays no part in fitting or choosing the method. The same past-only reconstructed series is used throughout. Overlapping seven-day targets and moving stay windows mean the examples are strongly dependent and are not 30 independent trials. Dates/parameters were chosen for a short research demonstration; only broader independently designed external tests would support a deployment decision.

An illustrative nominal 80% symmetric interval uses the ceil((n+1)×0.8) ordered absolute error on the May calibration examples of the selected method, with lower endpoint clipped to zero. Model selection and interval calibration use the same window, which can bias results; temporal dependence and distribution shift invalidate a guaranteed coverage interpretation. June empirical coverage is reported alongside the range. Even if the June result were positive, the holdout would not establish operational validity.

The planner does not convert these records into inventory, forecasts or profit: booking records are not room-nights or flight seats, the geographic and time domains differ, no calibrated cancellation rate or current supplier data exists, and the June holdout is not a production validation. The existing planner continues using its clearly labelled unvalidated heuristic.

## Adaptive rolling follow-up and locked later test

The June fixed-model test above was examined before developing this follow-up. We tried multiple recent training windows and selection thresholds against June; the final fixed choices (21 days and 20% required improvement) were selected using that development period. **June is therefore not an independent test of this follow-up.** We then evaluated July–August and September without changing the method after inspecting their outcomes. The app displays September, with July–August results below. These later periods were not used in that parameter search, but all come from the same old dataset; they are not independent properties or prospective deployment tests.

At each historical as-of date, fit a ridge regression on the 21 most recent examples whose entire seven-day outcome has already ended: as-of−27 through as-of−7. For method selection, replay 28 prior forecast dates, from as-of−34 to as-of−7. Each prior candidate is fitted using only training labels that would have been complete at **its own** as-of date. Compare the model's MAE with the prior-seven-day-count baseline on replay dates where both are available. Use the trained model only if its MAE is at least 20% lower than baseline; otherwise fall back to baseline. If fewer than 20 paired replay forecasts or 21 training examples are available, do not select the model.

The displayed interval is the nominal 80% empirical absolute-error radius from these same prior replays for the selected method (lower bound clipped to zero). The method selection and interval calibration are not independent and data are autocorrelated, so this interval has no guaranteed coverage. All metrics are retrospective, and labels are reconstructed from a later arrival-selected extract; this replay cannot establish that the actual historical records were available as assumed.

Results in gross booking records, lower MAE is better:

| Period | Hotel | Adaptive MAE | Baseline MAE | Trained model selected | Nominal 80% range coverage |
|---|---|---:|---:|---:|---:|
| Jul–Aug 2016 | City | 50.29 | 50.29 | 0/62 days | 59.7% |
| Jul–Aug 2016 | Resort | 8.26 | 8.26 | 0/62 days | 90.3% |
| Sep 2016 | City | 105.95 | 100.33 | 6/30 days | 73.3% |
| Sep 2016 | Resort | 35.13 | 35.13 | 0/30 days | 50.0% |

These overlapping forecast dates share many bookings, so sample sizes are not independent events. The adaptive approach did not improve on the baseline in these tests; its confidence intervals did not meet their nominal coverage in most periods. It remains excluded from procurement allocation.

## Update (Nov 2026): smoothed weekly level as the default forecast

**What failed.** "Last 7 days" is a noisy estimate of the booking rate, and the 21-day ridge model rarely beat it by the required 20%.

**What changed.** The fallback is now a smoothed weekly level: ½ × last week's bookings + ½ × the weekly average of the three weeks before, for the same arrival window. That works out to weights of 2/3, 1/6 and 1/6 on the latest four weeks.
- It is the simplest decaying-weight average, with no fitted parameters.
- Candidates were compared on **April–June 2016 development data** (the 88 replay dates per hotel, MAE, lower is better):

| Candidate | City | Resort |
|---|---:|---:|
| Last 7 days | 36.0 | 10.7 |
| Weekly average of weeks 2–4 | 33.3 | 10.6 |
| Mean of the latest four weeks | 30.2 | 9.5 |
| **Smoothed level** | **29.7** | **9.3** |

- It was fixed before July–September was scored.
- The trained ridge model must now beat the smoothed level by 20% on the same 28 replay dates, and the interval radius is calibrated on the selected method's errors exactly as before. The "last 7 days" baseline stays the scoring reference.

**Also tested and rejected.** A booking-pace model (same as-of date last year × this year's pace) could only be checked on June: 2015 data begins in July. It won on City in September (66.0) but lost badly elsewhere (Resort September 103.9), so it was not adopted.

**Results** (gross booking records, adaptive vs last 7 days):

| Period | Hotel | Adaptive MAE | Last-7-days MAE | Skill | Trained model selected | Nominal 80% range coverage |
|---|---|---:|---:|---:|---:|---:|
| Apr–Jun 2016 (development) | City | 29.7 | 36.0 | 17.3% | 0/88 | 89% |
| Apr–Jun 2016 (development) | Resort | 9.3 | 10.7 | 13.5% | 0/88 | 77% |
| Jul–Aug 2016 | City | 46.6 | 50.3 | 7.4% | 0/62 | 65% |
| Jul–Aug 2016 | Resort | 8.2 | 8.3 | 0.6% | 0/62 | 90% |
| **Sep 2016 (displayed)** | **City** | **76.4** | **100.3** | **23.8%** | 0/30 | 80% |
| **Sep 2016 (displayed)** | **Resort** | **32.5** | **35.1** | **7.5%** | 0/30 | 50% |

**How to read it.**
- **Point forecast:** the smoothed level beats "last 7 days" in every period for both hotels.
- **Ranges:**
  - Coverage is near nominal for City in September.
  - It falls to 50% for Resort in September: demand there more than doubled within weeks (the average next-week count rose from 33 in April–June to 85), faster than errors from the previous four weeks anticipate.
  - Three variants changed nothing: relative errors, asymmetric signed-error quantiles, and a 56-day calibration window.
  - The app labels this case "Beats baseline · range under-covers" instead of "passed".
- **Allocation:** this study remains outside the procurement allocation. The planner's own forecasts come from the monthly learned model (`learned-demand.ts`), validated per product against "same month last year".
