import assert from 'node:assert/strict';
import {searchCachedFares} from '../src/lib/travelpayouts';
async function main(){const urls:string[]=[];const fake=async(input:RequestInfo|URL,init?:RequestInit)=>{const u=String(input);urls.push(u);assert.equal(new Headers(init?.headers).get('X-Access-Token'),'private');if(u.includes('2026-11-15'))return new Response('oops',{status:500});return Response.json({success:true,currency:'inr',data:[{price:5200,airline:'AI',transfers:0,departure_at:'2026-11-14T10:00:00',found_at:'2026-11-13T12:00:00Z'}]})};
 const r=await searchCachedFares('BOM','DEL',['2026-11-14','2026-11-15'],'private',fake as typeof fetch);assert.equal(r[0].offers[0].total,5200);assert.equal(r[0].offers[0].foundAt,'2026-11-13T12:00:00Z');assert.ok(r[1].error);assert.ok(urls.every(u=>!u.includes('private')));console.log('Cached fare provider parsing and partial-error mock tests passed');}
main().catch(e=>{console.error(e);process.exitCode=1});
