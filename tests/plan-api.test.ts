import assert from 'node:assert/strict';
import {createPlan,opportunities} from '../src/lib/procurement';
async function main(){
 const input={items:opportunities,budget:5000000,risk:.35,asOf:'2026-11-13'};
 async function post(data:unknown){const response=await fetch((process.env.TEST_BASE || 'http://127.0.0.1:3000')+'/api/procurement/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()};}
 const response=await post(input);assert.equal(response.status,200,JSON.stringify(response.body));const local=createPlan(input.items,input.budget,input.risk,{asOf:input.asOf});assert.equal(response.body.summary.spend,local.reduce((a,r)=>a+r.spend,0));assert.equal(response.body.recommendations.length,input.items.length);assert.equal(response.body.model,'scenario-grid-v3');assert.ok(response.body.optimization.upperBound>=response.body.optimization.objective);assert.ok(response.body.optimization.objective>=response.body.optimization.baselineObjective);assert.ok(response.body.summary.spend<=input.budget);assert.equal((await post({...input,budget:-1})).status,400);assert.equal((await post({...input,asOf:'2026-02-30'})).status,400);assert.equal((await post({...input,items:[{...input.items[0],quoteExpiry:'2026-11-10'}]})).body.recommendations[0].qty,0);
 console.log('Planning API integration checks passed');
}
main().catch(e=>{console.error(e);process.exitCode=1});
