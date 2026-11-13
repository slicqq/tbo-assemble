# Flight intelligence: setup, data and limits

## Optional free-account cached flight fares

This app does **not** use Amadeus Self-Service; the portal was decommissioned. Instead, the optional fare lookup uses the [Travelpayouts / Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API). Its data is a cache of prices found by other users, not a live search, and may be stale, unavailable or not bookable. It provides no guaranteed supplier availability or wholesale prices. Check the provider's current terms and eligibility.

To enable cached prices, register for a Travelpayouts account and obtain a Data API token; registration and the Data API are advertised as free for partners, subject to provider terms and limits. This uses the Data API directly, not a paid third-party wrapper. Store the token on your server, not in chat or client code:

```text
TRAVELPAYOUTS_TOKEN=your_free_account_token
```

Put this in an ignored `.env.local` locally or in the deployment provider's environment settings, then restart the server. Without a token, the forecast, news and weather still work; fare lookup reports that setup is needed. A response may not contain a found/expiry timestamp, in which case the UI says so rather than inventing freshness. Provider seats and confirmed prices are not available. The endpoint has no production authentication or rate limiting; add them before exposing a server token publicly. The adapter is tested with mocked responses, not with a real token.

## Free public signals

The page requests Google News RSS headlines and Open-Meteo forecasts directly through the server; no user API key is required. Open-Meteo's free service is for non-commercial use and subject to their terms and limits, so do not assume a commercial deployment is free. Results may be unavailable or incomplete. Weather is a forecast for the next two local calendar days, not known future actual weather. Neither weather nor news automatically influences the forecast.

## Historical CSV

Download the synthetic example or upload your own. Files are parsed locally in the browser. The case-sensitive header is:

```text
date,origin,destination,bookings,cancellations,searches,minFare
```

- `date`: UTC booking/observation date, YYYY-MM-DD, **not the departure date**.
- `origin`, `destination`: uppercase three-letter IATA codes.
- `bookings`: gross bookings made on this route that day, aggregated across future departure dates.
- `cancellations`: cancellations of those same bookings (0 through bookings). If the source instead logs all cancellations that occurred on a day, this schema does not apply; transform it appropriately rather than mislabel it.
- `searches`: comparable route searches that day. Look-to-book is gross bookings/searches over the latest 7 completed days.
- `minFare`: observed minimum comparable fare for the route in INR on that date; leave blank if unavailable. Ensure comparable cabin, trip type, passenger count, travel-date mix and collection time. Real provider offer snapshots are not automatically stored as historical data.

At most one row per UTC date and route, maximum 5,000 rows and 1 MB. The forecast as-of date excludes all same-day and future records to avoid look-ahead bias. The last seven days must be contiguous and end the day before as-of. For each target date (today and tomorrow), the baseline is 50% the last-seven-day average plus 50% the average of all historical observations for the same weekday; net bookings are gross minus cancellations. Each rolling backtest trains only on observations available before the relevant target and forecast horizon. Mean absolute error (MAE) is displayed only when there are at least five valid test windows. Metrics are retrospective and do not guarantee accuracy. This is not a trained or validated model and is not automatically fed into inventory buying or selling decisions.

## News and tomorrow's data

Google News RSS search supplies matching recent English-language headlines. The app retains titles containing the destination and travel/aviation terms; coverage and relevance vary, and filtering can miss relevant stories. News is shown as context and is **not** incorporated into the forecast. No evidence of predictive value or article sentiment model is claimed. Future realized bookings, cancellations, prices or news cannot be known today. A future enhancement could incorporate forecast weather, published events, on-the-books reservations and news features after timestamp-safe historical validation. The current feature does not ingest these and does not automatically buy or sell tickets.
