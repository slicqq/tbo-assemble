# Cancellation and booking-risk sandbox

This browser-only illustration considers **one already-purchased block** from the current plan. It does not change the optimizer, make a booking, fetch actual cancellations or recommend overbooking. The user specifies a hypothetical, fixed number of accepted bookings; the tool assumes that number is obtained, not that demand will materialize. All values, including fees and probability, are assumptions and should be checked against actual contracts and customer-protection obligations.

## Inputs and calculation

The block's purchased quantity, purchase unit price, one-time supplier fee, selling price and unsold recovery percentage come from the current plan. Existing stock is not added. The user supplies a count of hypothetical bookings, a cancellation probability, a fee retained per cancelled booking (at most the selling price), and an extra cost per denied customer. Customers who do not cancel are assumed to arrive; arrivals above purchased capacity are denied, fully refunded and incur the specified extra cost.

Cancellations follow a binomial distribution: the same probability applies to each booking, independently. For each possible cancellation count, the tool calculates cancellations, served bookings, unsold units and denied customers. It sums these using their binomial probabilities to report expected quantities and the probability that at least one customer is denied. Expected profit is:

`served × selling price + cancellations × cancellation fee + unsold × unit cost × recovery rate − purchased quantity × unit cost − one-time fee − denied × extra denial cost`, averaged across outcomes. Denied bookings earn no revenue because full refunds are assumed. The extra denial cost excludes that full refund, which is already accounted for by recording no revenue. Unsold recovery is applied once and is not a guaranteed supplier refund.

Counts are capped at 1,000 bookings and 500 purchased units for responsive, deterministic calculation. The binomial weights are evaluated from the distribution's mode to remain stable at large counts. Changing inputs clears results until the user recalculates.

## Important limitations

Identical independent probabilities do not capture correlated disruptions, cancellation timing, no-shows, partial refunds, tax, chargebacks, rebooking or other contract conditions. The assumed denial cost can be much smaller than actual relocation, legal, reputational and regulatory costs. There is no estimate of demand, customer arrival time or probability that a proposed number of bookings will occur. Future bookings after cancellations and resale are not modeled. The sandbox's profit is conditional on its fixed hypothetical bookings and is not directly comparable to the portfolio's forecast-based expected profit. It does not use private booking data or persist scenario settings. Verify data, supplier terms and applicable rules before acting.
