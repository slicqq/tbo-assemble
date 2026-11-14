# Budget allocation method (scenario-grid-v3)

This is an illustrative decision-support model, not a validated demand forecast or investment recommendation. Inputs, demand weights, price elasticity, cancellation rates, risk and scenario weights are assumptions; no supplier is connected and no order is placed.

For each opportunity and possible whole-unit quantity, the app computes the best risk-adjusted modeled payoff across five candidate selling prices. It combines those choices using a 1,000-bucket budget-grid dynamic program. Each product's total cost is rounded **up** to a bucket, so the chosen combination cannot intentionally exceed the specified budget. It also computes the earlier greedy allocation and returns whichever feasible plan has the higher modeled score. A numerical check rejects any over-budget candidate.

The displayed score is weighted expected modeled profit less the chosen downside penalty multiplied by the difference between expected and low-scenario modeled profits. The comparison uses that same score, not actual profit. Prices and costs use the same currency and unit. The method does not model supplier minimums, dependencies, cross-product substitution, taxes or refunds.

The app also evaluates a Lagrangian relaxation of the modeled budget constraint. Its value is an upper bound for the unrounded, whole-unit modeled problem, apart from floating-point arithmetic. The difference from the chosen score is an upper bound on the modeled optimization gap, not a confidence interval. A small gap does not validate the demand model or guarantee real-world profit. The search is approximate; it may not find the true optimum. Tests compare small synthetic cases against exhaustive enumeration and ensure spend stays within budget.

Snapshots save only the inputs and model version, not frozen outputs. Older `scenario-greedy-v2` inputs can be reopened and are recalculated with the newer `scenario-grid-v3` method; review results and assumptions again. The original shared dashboard is not private. Email ownership is currently unverified; do not upload sensitive data.
