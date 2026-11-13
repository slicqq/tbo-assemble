# Hotel demand forecasting: CSV guide

The Hotel Demand dashboard runs a simple historical baseline locally in your browser. It does not connect to a hotel, booking engine or supplier. The sample is synthetic and is not actual TBO data.

## Format

Upload UTF-8 CSV, maximum 1 MB and 5,000 data rows. Headers are case-sensitive:

```csv
date,hotel,bookedRoomNights,cancelledRoomNights,searches
2026-11-12,Example Hotel,42,3,500
```

- `date`: UTC **booking day**, formatted YYYY-MM-DD; one row per day per hotel, including days with zero activity.
- `hotel`: consistent hotel name or ID (up to 120 characters); duplicate day and hotel pairs are not allowed, case-insensitively.
- `bookedRoomNights`: gross room-nights booked that day, aggregated across future stay dates.
- `cancelledRoomNights`: room-nights cancelled from bookings made on that same day; must not exceed that day's booked room-nights. Cancellations of older bookings need separate handling and must not be included here.
- `searches`: same-day hotel searches. Displayed as part of the input but **not used** in the forecast.

Counts must be nonnegative whole numbers up to 10,000,000. Do not upload personal guest information. Data stays in your browser and is not persisted.

## Interpretation

The estimated quantity is net room-nights *booked on each booking day*, across a mix of stay dates. It is not occupancy, future stay-date demand, rooms available, or a prediction for a specific stay date. Same-day and future rows are excluded relative to the as-of date.

For each horizon, the forecast is 50% of the average of the latest seven completed days and 50% of the average of available historical observations for the target weekday. Seven consecutive days through the day before the as-of date are required. Rolling mean absolute error (MAE) uses horizon-correct, past-only backtests and is shown after at least five valid tests.

This baseline is uncalibrated, lacks real supplier data and is not a procurement recommendation. More complete cancellations, stay-date inventory, lead time, seasonality, supplier capacity, relevant price and external signals require new data and validation.
