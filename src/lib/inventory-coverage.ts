import {modeledDemandScenarios,type PlanRow} from './procurement-core';

/** Coverage of incremental demand after existing stock, using the SAME scenario
 * convention as the optimizer. Modeled sales are not confirmed bookings. */
export function coverageFor(row:PlanRow) {
 // risk-cvar-v5 rows carry coverage from the out-of-sample scenario evaluation (incl. allotments).
 if(row.coverage)return {need:row.coverage.need,served:row.coverage.served,unmet:row.coverage.unmet,highUnmet:row.coverage.highUnmet,incrementalCapacity:row.qty,existingStock:row.existingStock??0};
 // A zero-quantity row has no meaningful optimized selling price. Use its reference price.
 const cases=modeledDemandScenarios(row,row.qty>0?row.price:row.referencePrice);
 const need=cases.reduce((s,c)=>s+c.prob*c.incremental,0);
 const served=cases.reduce((s,c)=>s+c.prob*Math.min(row.qty,c.incremental),0);
 const unmet=cases.reduce((s,c)=>s+c.prob*Math.max(0,c.incremental-row.qty),0);
 const highUnmet=Math.max(0,cases[2].incremental-row.qty);
 return {need,served,unmet,highUnmet,incrementalCapacity:row.qty,existingStock:row.existingStock??0};
}
export function coverageTotals(rows:PlanRow[],kind:'Hotel'|'Flight') {
 const matching=rows.filter(row=>row.kind===kind);
 return matching.reduce((a,row)=>{const c=coverageFor(row);return {products:a.products+1,existingStock:a.existingStock+c.existingStock,incrementalCapacity:a.incrementalCapacity+c.incrementalCapacity,need:a.need+c.need,served:a.served+c.served,unmet:a.unmet+c.unmet,highUnmet:a.highUnmet+c.highUnmet};},{products:0,existingStock:0,incrementalCapacity:0,need:0,served:0,unmet:0,highUnmet:0});
}
