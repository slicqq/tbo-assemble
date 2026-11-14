import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const handlers={},deleted=[],writes=[];let online=true;
const caches={keys:async()=>['tbo-assemble-v4','tbo-assemble-v5','unrelated'],delete:async k=>{deleted.push(k);return true},open:async()=>({addAll:async()=>{},put:async(req)=>writes.push(req.url)}),match:async()=>null};
const self={location:{origin:'https://test.invalid'},clients:{claim:async()=>{}},skipWaiting(){},addEventListener:(name,fn)=>handlers[name]=fn};
const fetch=async()=>{if(!online)throw Error('offline');return new Response('NETWORK',{status:200})};
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,caches,fetch,URL,Response,console});
(async()=>{let activation;handlers.activate({waitUntil:p=>activation=p});await activation;assert.deepEqual(deleted,['tbo-assemble-v4']);
 for(const path of ['/secure-account','/login','/dashboard']){let response;handlers.fetch({request:{url:'https://test.invalid'+path,method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal(await (await response).text(),'NETWORK')}
 assert.equal(writes.length,0);
 online=false;let response;handlers.fetch({request:{url:'https://test.invalid/secure-account',method:'GET',mode:'navigate'},respondWith:p=>response=p});const offline=await response;assert.equal(offline.status,503);assert.ok((await offline.text()).includes('You are offline'));assert.equal(writes.length,0);
 for(const path of ['/api/events','/secure-account?_rsc=123','/_next/data/secret']){let intercepted=false;handlers.fetch({request:{url:'https://test.invalid'+path,method:'GET',mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false,path)}
 console.log('PASS: stale cache purge, network-only pages and no account/API cache');})().catch(e=>{console.error(e);process.exitCode=1});
