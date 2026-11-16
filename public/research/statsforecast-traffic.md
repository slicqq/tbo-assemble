# StatsForecast: offline route traffic study

**Research only.** This is a frozen retrospective comparison of industry-wide scheduled domestic passenger counts, not a forecast of TBO bookings, unmet demand, available seats, supplier prices, room-nights, or ticket prices. It does not feed the portfolio allocator or the separate one-week flight-price feature. The live traffic estimate and its freshness gate remain unchanged.

## Sources, timestamp and rights

Source: Directorate General of Civil Aviation (DGCA), Ministry of Civil Aviation, Government of India; historical compilation from [Vonter/india-aviation-traffic](https://github.com/Vonter/india-aviation-traffic), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), plus official DGCA city-pair workbooks listed with their original URLs and SHA-256 hashes in `data/statsforecast/route-traffic-snapshot.json`. DGCA's [website policy](https://www.dgca.gov.in/digigov-portal/jsp/dgca/footerLink/WebsitePolicy.jsp) requires accurate reproduction and attribution, and excludes third-party copyrighted material. The captured route database is made available under ODbL 1.0 where applicable; this attribution is not a legal determination of rights to third-party material. Review DGCA and ODbL obligations before redistribution or commercial use. The open-source StatsForecast library is [Apache-2.0](https://github.com/Nixtla/statsforecast).

The experiment uses data through **September 2026**. The API reported capture times around **15 November 2026 UTC**, which are inconsistent with the session date of 13 November 2026; the source/server clock is unverified. Do not interpret these timestamps as confirmed freshness or as proof that observations existed at a historical prediction date. The complete snapshot SHA-256 and per-route row and source-manifest hashes are in the [results JSON](/research/statsforecast-study.json); source manifest equality is not proof of historical publication dates. Existing Mumbai and Navi Mumbai labels are not combined, and changing airport definitions can affect comparisons.

## Reproduce

From the repository root, create a Python virtual environment and `pip install -r scripts/requirements-statsforecast.txt`, then run `OPENBLAS_NUM_THREADS=1 NUMBA_NUM_THREADS=1 python scripts/statsforecast_traffic.py` and `npx tsx scripts/compare-statsforecast-current.ts`. The frozen input is `data/statsforecast/route-traffic-snapshot.json`; the Python script verifies every route's row hash before fitting. `python -m unittest tests/statsforecast_traffic_test.py -v` tests the synthetic replay logic. Capture script `scripts/capture_statsforecast_traffic.py` generates a new, potentially different snapshot; recapturing is not required for reproduction. Package versions and snapshot hash are in the results. Exact floating point results may vary with platform or dependencies. Never use credentials in the snapshot.

## Protocol

For each target, assume data through target minus two months was available (an assumed one-month reporting delay). Fit 36 monthly observations, allowing at most two gaps in training, each filled **only with its raw value from one year before that gap**. The latest training observation, target, and target's prior-year baseline must be observed; duplicate, conflicting, malformed and missing months are excluded, never treated as zero. Forecast two steps from the cutoff. The two StatsForecast candidates are `SimpleExponentialSmoothingOptimized` and seasonal `AutoETS` (12 months); simple comparators are last observed and same month last year. On any fit error or non-finite prediction, that target is excluded from **all** four candidates to preserve common-month scoring. The published per-target rows show matched months and imputations; differences from the requested windows are excluded. The results JSON reports counts of missing targets, baseline inputs, insufficient history, invalid outputs and fit failures for each window; fit exception details are not captured.

Choose on matched 2024–2025 months (minimum 12). The better StatsForecast candidate must improve MAE by more than 5% versus the better baseline, or the baseline is selected. Freeze that choice, then score February–September 2026. The “best baseline” for describing later results is calculated on those later outcomes; it is not a deployable hindsight selection. Lower MAE is better. No independent prediction interval is fitted. These windows and model design were selected after viewing historical data. Published records may have been revised and historical availability is not verified; this is **not a prospective holdout**.

The existing implementation (`studyTraffic`) separately selects its adaptive-or-baseline policy using its own 2024–2025 eligible sample; the added comparison scores that unchanged policy and all four experimental methods on the intersection of their eligible later months. It also scores the existing adaptive replay and experimental methods on the intersection of the earlier months. Fitted methods use imputed history where permitted; the existing method does not impute. A fair common outcome sample does not mean identical input or publication vintages.

## Update (Nov 2026): the planner's learned model as a fifth candidate

**What changed and what did not**
- **One new candidate:** the planner's own learned seasonal model (`src/lib/learned-demand.ts`, `forecastFrom`).
  - At every cutoff it is refitted on data up to that cutoff only: log traffic on month-of-year effects and a trend, Huber-weighted, on the latest 48 usable months.
  - Projection uses the median year-on-year change of the latest 12 months, anchored on the median deseasonalised level of the latest three months.
  - COVID months (Mar 2020 – Feb 2022), months the source marks ambiguous (BOM Dec 2025, when Navi Mumbai opened) and months the study imputed are left out, so it never uses a value the other candidates did not have.
- **Everything else is unchanged:**
  - the snapshot (same SHA-256), routes, target months, actuals and two-month cutoffs;
  - the selection rule (best model candidate must beat the better baseline by more than 5% on 2024–25, else that baseline);
  - the scoring window (Feb–Sep 2026).
- **Consistency check:** re-applying the rule to the original four candidates reproduces every original selection.
- **Reproduce:** `npx tsx scripts/learned-traffic-study.ts` writes `learned-traffic-study.json`; `tests/learned-traffic-study.test.ts` checks the snapshot hash, the reproduced selections and MAEs, no use of data after the cutoff, and that the artifact matches a fresh run.

| Route | Original selection | Selection with the learned model | Later MAE of new selection | Last observed | Same month last year | Learned model |
|---|---|---|---:|---:|---:|---:|
| BOM → DEL | Last observed | **Learned model** | 8,436 | 25,322 | 12,837 | 8,436 |
| DEL → BOM | SES | **Learned model** | 9,964 | 24,153 | 13,533 | 9,964 |
| DEL → PNQ | Same month last year | Same month last year | 5,237 | 7,833 | 5,237 | 6,131 |
| PNQ → DEL | Seasonal AutoETS | Seasonal AutoETS | 10,803 | 8,550 | 6,873 | 6,177 |
| BLR → DEL | SES | SES | 15,942 | 15,487 | 18,944 | 16,704 |
| DEL → BLR | Same month last year | **Learned model** | 11,679 | 13,725 | 18,138 | 11,679 |

**Results**
- **Main result:** with one more candidate under the unchanged rule, the selected policy beats "last observed month" in the later period on **4 of 6 routes** (previously 2). The learned model is selected on 3 routes.
- **The learned model on its own** beats "last observed month" on 5 of 6 routes and is the most accurate of the five methods on 4.
- **Where it fails:** the learned model is not a universal winner. On Bengaluru → Delhi it is worse than "last month" in 2026 (16,704 vs 15,487), and on Pune → Delhi the earlier-selected AutoETS still loses to "last month" (10,803 vs 8,550), although the learned model would have won there (6,177).

**Other selection rules, reported for transparency** (all choose on 2024–25 only)
- The planner's own gate (learned model if it beats "same month last year" by more than 5%, else that baseline) beats "last month" on 5 of 6.
- Plain lowest earlier MAE beats it on 3 of 6.
- The study's original rule is the primary result because it was fixed before this candidate existed.

**Caveats (unchanged):** 7–8 later months per route, revised data with unverified publication timing, and windows chosen after viewing the history. This is not a prospective holdout.

## Interpretation and next step

On this snapshot the earlier-selected experimental policy had higher later-period error than the best simple baseline on five of six routes and matched it on one; each later score has just 7–8 matched months. Other individual candidates can do better on particular routes, but selecting them after inspecting later results would leak information. Retain the current rule and fallback. To decide whether to promote a method, collect timestamped immutable source vintages, test multiple routes and rolling future windows, assess calibration and material changes, and validate with actual TBO demand and economics. No such validation or procurement benefit is established here.
