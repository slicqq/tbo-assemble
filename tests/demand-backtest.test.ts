import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {evaluateDemandBacktest,readDemandBacktestCSV,syntheticDemandBacktestCSV} from '../src/lib/demand-backtest';
const rows=()=>readDemandBacktestCSV(syntheticDemandBacktestCSV());
test('strictly past labels fit a training-only blend and compare locked chronological holdout',()=>{
 const all=rows(),result=evaluateDemandBacktest(all,'2025-02-01');
 assert.equal(result.testCount,12);assert.ok(result.trainCount>=20);assert.ok(result.trainLatestOutcome<result.testStart);assert.ok(result.purged>=1);
 assert.equal(result.weight,.2);assert.ok(result.fittedMae<result.baselineMae);assert.ok(result.fittedMae<result.currentMae);
 const changed=all.map((r,i)=>i>=36?{...r,actualNetUnits:r.actualNetUnits+300}:r);const modified=evaluateDemandBacktest(changed,'2025-02-01');
 assert.equal(modified.weight,result.weight,'holdout targets must not tune model');assert.ok(modified.fittedMae>result.fittedMae);
});
test('unknown outcomes are excluded, with no false zero-denominator metric',()=>{
 const all=rows(),limited=evaluateDemandBacktest(all,'2024-10-01');assert.ok(limited.excludedFuture>0);assert.ok(limited.trainLatestOutcome<limited.testStart);
 const zero=evaluateDemandBacktest(all.map(r=>({...r,actualNetUnits:0})),'2025-02-01');assert.equal(zero.baselineWape,null);assert.equal(zero.currentWape,null);assert.equal(zero.fittedWape,null);
});
test('rejects overlapping periods, unequal leads, inconsistent product and malformed numeric data',()=>{
 const csv=syntheticDemandBacktestCSV(),lines=csv.split('\n');
 assert.throws(()=>readDemandBacktestCSV([lines[0],lines[1],lines[1]].join('\n')),/overlap or repeat/);
 assert.throws(()=>readDemandBacktestCSV(lines.map((x,i)=>i===2?x.replace('synthetic-hotel','different'):x).join('\n')),/one opportunity_id/);
 assert.throws(()=>readDemandBacktestCSV(lines.map((x,i)=>i===2?x.replace('2024-01-13','2024-01-12'):x).join('\n')),/same snapshot lead time/);
 assert.throws(()=>readDemandBacktestCSV(lines.map((x,i)=>i===1?x.replace(',0.05,',',NaN,'):x).join('\n')),/conversion/);
 assert.throws(()=>evaluateDemandBacktest(rows(),'2024-03-01'),/At least/);
});
