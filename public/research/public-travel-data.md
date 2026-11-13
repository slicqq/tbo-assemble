# Travel prediction lab: public data and method

## Data used

António, N., de Almeida, A. and Nunes, L. (2019), “Hotel booking demand datasets,” *Data in Brief* 22, 41–49, DOI [10.1016/j.dib.2018.11.126](https://doi.org/10.1016/j.dib.2018.11.126). The open access article is CC BY 4.0; verify the underlying data's own terms before any independent redistribution or commercial use. The paper describes 40,060 resort hotel and 79,330 city hotel bookings for arrival dates from 1 July 2015 to 31 August 2017, sourced from hotel property-management systems in Portugal. These are **not TBO records**, India data, travel searches, current availability or transactions across the entire travel industry.

The reproduced aggregate is derived from the [TidyTuesday public CSV copy](https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2020/2020-02-11/hotels.csv) (SHA-256 `7c2ae42a7353905ea136e5c2287f17c92c5435826598bfbb8491c6f0c7b1fc06`). For each source record, inferred booking day = reported arrival date minus reported lead time. Counts include all records including those eventually cancelled. We retained inferred booking days from 1 January to 30 June 2016: 31,971 records and 364 aggregate hotel-days (182 per hotel). The data file has no guest identifiers; the full source is not stored in this repository. `python scripts/prepare_public_hotel_data.py` downloads, checks the source checksum and regenerates the committed daily aggregate.

## Important selection and timing limitations

- The source is a final booking extract whose selection is based on **arrival date**, not a complete log of bookings entered each day. Booking records for stays outside the arrival window are missing. This is arrival-window censoring; zeros represent zero records in this restricted sample, not necessarily zero real bookings.
- Lead time and other fields are from a later snapshot; if bookings were changed, arrival minus lead time may not reflect the true initial booking date. The retrospective labels were not necessarily observable on the prediction day. Thus this backtest is useful for testing the mechanics, but does not establish real-time performance.
- The count is gross booking records, including eventual cancellations, not hotel room-nights, occupancy, a complete demand measure, TBO customer transactions or actual completed stays. Predictions concern booking days, not future stay dates.
- Hotel properties, place, time, currency and mix differ from TBO. The old sample cannot provide current Indian demand forecasts. TBO operational data and an as-of-safe evaluation are required for that purpose.

## Model and evaluation

The displayed forecast is a fixed baseline: 50% mean of the previous seven completed booking days plus 50% mean of the last four matching weekdays for the target. Both horizons use only records strictly before the historical as-of day. At least 28 calendar days of prior history are needed for the blend.

The rolling holdout target window is 2 May–30 June 2016, separately for the as-of day (one-day horizon) and following day (two-day horizon). We evaluate the blend and a simple seven-day average on exactly the same targets using mean absolute error (MAE), without fitting on the target or later observations. This is an expanding-history replay, not an untouched single static test set; historical outcomes from earlier test dates are used for later predictions once their date has passed. The model is not selected using the holdout. The backtest cannot correct the source's censoring or historical availability issues.

## Other researched sources (not integrated into the forecast)

- [US Bureau of Transportation Statistics T-100 monthly summary](https://catalog.data.gov/dataset/aff-t100-segment-summary-monthly): public US aggregate passengers/seats, not TBO bookings or Indian demand.
- [India Ministry of Tourism monthly arrivals index](https://dataful.in/datasets/77/): useful context where accessible, but aggregate arrivals are not TBO searches or booking demand; access and reuse rights need verification.
- [Jun Lu airline ticket-price data](https://github.com/junlulocky/data_airticket): historical 2015–2016 fares, not current prices or bookings.
- The existing Flight Predictions feature can query Travelpayouts cached fare context and accept uploaded route history. Its estimates do not currently use this hotel research data.

No automatic decision, booking, supplier connection, real-time TBO data or paid service is provided. Independent validation, access controls, fresh data and supplier contracts are required before commercial decision-making.
