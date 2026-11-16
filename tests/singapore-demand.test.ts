import {test} from 'node:test';import {strict as assert} from 'node:assert';
import data from '../src/data/singapore-gross-lettings.json';
import {addMonths,evaluateSingapore,singaporeForecast,SINGAPORE_SHOCK} from '../src/lib/singapore-demand';
import {rollingForecasts} from '../src/lib/learned-demand';
test('replays real licensed snapshot with frozen chronology: the fitted blend fails, the learned model passes the fixed rule',()=>{const e=evaluateSingapore(data.rows);assert.equal(data.rows.length,225);assert.equal(e.trainCount,24);assert.equal(e.validation.count,21);assert.equal(e.holdout.count,12);
 // The blend weight is fitted on 2022-23 (Singapore's reopening year), where the three-month lag wins: weight 0 = lag-3, which then fails.
 assert.equal(e.weight,0);assert.equal(Math.round(e.holdout.blend),136096);assert.equal(Math.round(e.holdout.seasonal),61435);assert.equal(Math.round(e.holdout.lag3),136096);
 // The planner's learned model is chosen on validation and beats both baselines by more than 5% on validation and holdout.
 assert.equal(e.model,'learned');assert.equal(e.passed,true);assert.equal(e.chosen,'learned');
 assert.ok(e.validation.learned<.95*e.validation.seasonal&&e.validation.learned<.95*e.validation.lag3);
 assert.ok(e.holdout.learned<.95*e.holdout.seasonal&&e.holdout.learned<.95*e.holdout.lag3);
 assert.equal(Math.round(e.validation.learned),59727);assert.equal(Math.round(e.holdout.learned),45392);assert.equal(Math.round(e.radius),88272);assert.equal(e.holdout.coverage,11/12)});
test('learned forecasts use only data at least three months old',()=>{
 const history=(rows:typeof data.rows)=>rows.map(r=>({month:r.month,bookings:r.occupiedRoomNights,...(r.month>=SINGAPORE_SHOCK.from&&r.month<=SINGAPORE_SHOCK.to?{exclude:true}:{})}));
 const at=(rows:typeof data.rows,m:string)=>rollingForecasts(history(rows),3).find(x=>x.month===m)!.forecast;
 const changed=data.rows.map(r=>r.month==='2026-07'||r.month==='2026-08'?{...r,occupiedRoomNights:r.occupiedRoomNights*3}:r);
 assert.equal(at(changed,'2026-09'),at(data.rows,'2026-09'),'the Sep 2026 forecast ignores Jul and Aug 2026');
 const changedJune=data.rows.map(r=>r.month==='2026-06'?{...r,occupiedRoomNights:r.occupiedRoomNights*3}:r);
 assert.notEqual(at(changedJune,'2026-09'),at(data.rows,'2026-09'),'but uses Jun 2026 (lag 3)');
 for(const x of evaluateSingapore(data.rows).holdout.examples)assert.ok(Number.isFinite(x.prediction)&&x.prediction>0);});
test('future holdout changes cannot affect training fit or validation selection',()=>{const e=evaluateSingapore(data.rows);const rows=data.rows.map(r=>r.month>='2025-10'?{...r,occupiedRoomNights:r.occupiedRoomNights*2}:r);const changed=evaluateSingapore(rows);assert.equal(e.weight,changed.weight);assert.equal(e.fallback,changed.fallback);assert.deepEqual(e.validation,changed.validation)});
test('future snapshot or release never gets presented as current',()=>{const r=singaporeForecast(data,Date.parse('2026-11-13T12:00:00Z'));assert.equal(r.state,'clock');});
test('forecast only with contemporaneous date and complete recent data',()=>{const r=singaporeForecast(data,Date.parse('2026-11-16T00:00:00Z'));assert.equal(r.state,'ready');if(r.state!=='ready')return;assert.equal(r.target,'2026-12');assert.equal(Math.round(r.prediction),1542550);assert.equal(Math.round(r.lower),1454278);assert.equal(Math.round(r.upper),1630821);assert.equal(singaporeForecast(data,Date.parse('2027-02-01T00:00:00Z')).state,'stale');});
test('duplicates missing series and bad months fail closed',()=>{assert.throws(()=>evaluateSingapore([...data.rows,data.rows[0]]));assert.throws(()=>evaluateSingapore(data.rows.filter(r=>r.month!=='2026-03')));assert.throws(()=>addMonths('2026-13',1));assert.equal(addMonths('2026-01',-3),'2025-10')});
