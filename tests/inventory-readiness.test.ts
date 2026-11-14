import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {inventoryReadiness} from '../src/lib/inventory-readiness';
import {opportunities} from '../src/lib/procurement';
test('reports missing, expired and absent trends without inventing data quality',()=>{
 const base=opportunities[0];
 const inputs=[{...base,quoteExpiry:'2026-11-12',previousBookings:10,previousSearches:20},{...base,id:'missing',quoteExpiry:undefined,previousBookings:0,previousSearches:1},{...base,id:'valid',quoteExpiry:'2026-11-14',previousBookings:1,previousSearches:1}];
 assert.deepEqual(inventoryReadiness(inputs,'2026-11-13'),{total:3,missingQuoteExpiry:1,expiredQuotes:1,missingTrends:1});
 assert.deepEqual(inventoryReadiness([],'2026-11-13'),{total:0,missingQuoteExpiry:0,expiredQuotes:0,missingTrends:0});
});
