# Manual supplier quote review

The supplier quote review in the inventory workspace is a browser-only, manual workflow. It is **not** a supplier connection and does not send enquiries, retrieve inventory, make bookings, confirm pricing or create purchase commitments. Quotes are not sent to the planner, stored in an account or included when saving a plan. Reloading the page clears them. The existing supplier labels in synthetic planner inputs are descriptive, not API connections.

## Use

Download the CSV template; the example rows are entirely synthetic and must be replaced. Import up to 100 quotes, each with a unique `quote_id`, an `inventory_id` matching the active planner inventory exactly, a supplier name, `unit` of `seat` for flights or `room-night` for hotels, `unit_price_inr`, whole `available_units` and `minimum_units`, UTC observation and expiry timestamps, and descriptive `cancellation_terms` and `taxes_fees`. Use `Unknown` if the latter terms are unknown; don't infer they are included. Timestamps must use `YYYY-MM-DDTHH:MM:SSZ` (UTC); expiry must follow observation. Use the IDs from your inventory CSV; do not use a person's data or API credentials in quote fields.

The panel compares only what was supplied. It flags an unmatched ID, incorrect unit, observation in the future, or expiry at or before the current browser time. Status is checked again periodically and when the tab is shown. The user's device clock must be correct; the supplied timestamps, availability, prices and terms have not been independently verified. A status within validity is **not** a bookable quote. The file import is all-or-nothing: invalid files leave the previous data unchanged. A filter helps review records sharing an ID; verify manually that the flight or hotel, dates, passenger occupancy, room type and rate basis are genuinely equivalent. A lower unit price is not necessarily the better offer: minimum purchases, quantities, taxes, cancellation penalties, allotments, supplier reliability and contractual restrictions matter.

No supplier data automatically affects the allocator. Its other data and forecasts are illustrative and its existing date-based quote gate is not a substitute for live revalidation. Confirm every price, tax, term, quantity and availability directly with the supplier before committing funds. The application does not reserve a quote.

## Future integration

[TBO's API page](https://www.tbo.com/tbo-api) describes live price and availability for its partners. Access, credentials, technical documentation, use rights and commercial terms must be confirmed with TBO before integration. The user's existing [Travelpayouts data API](https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API) returns cached past search results; it is not a supplier allotment or pre-buy API. It must not be relabelled as live bookable stock. No TBO credentials are requested or stored in this interface.
