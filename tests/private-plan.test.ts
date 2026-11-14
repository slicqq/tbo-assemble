import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validatePlanInput } from '../src/lib/private-plan';
import { opportunities } from '../src/lib/procurement';
const valid = {items: opportunities, budget: 5000000, risk: .35, asOf: '2026-11-13', source: 'synthetic'};
test('saved plan round-trips, bounds model inputs and rejects malformed records', () => {
  const result=validatePlanInput(valid);
  assert.equal(result.items.length,opportunities.length);
  assert.equal(result.items[0].id,opportunities[0].id);
  assert.equal(result.items[0].quoteExpiry,opportunities[0].quoteExpiry);
  assert.throws(()=>validatePlanInput({...valid,items:[{...opportunities[0],capacity:99999999}]}));
  assert.throws(()=>validatePlanInput({...valid,items:[]}));
  assert.throws(()=>validatePlanInput({...valid,budget:Infinity}));
  assert.throws(()=>validatePlanInput({...valid,risk:.9}));
  assert.throws(()=>validatePlanInput({...valid,asOf:'2026-02-30'}));
  assert.throws(()=>validatePlanInput({...valid,source:'real'}));
  assert.throws(()=>validatePlanInput({...valid,items:[{...opportunities[0],buy:{bad:true}}]}));
});
