/** Destructive TEST-ONLY integration test: it refuses any non-local isolated database. */
import assert from 'node:assert/strict';
import {PrismaClient} from '../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
const allowed='postgresql://tbo_test:tbo_test@127.0.0.1:5432/tbo_test';
if(process.env.DATABASE_URL!==allowed||process.env.BOOKING_TEST_URL!=='http://127.0.0.1:3000')throw new Error('Refusing to run: explicitly configure isolated test database and local API');
const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:allowed})});
const endpoint=process.env.BOOKING_TEST_URL+'/api/bookings';
async function post(body:object){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}}
async function main(){
 const agent=await prisma.agent.create({data:{name:'Capacity test',email:`test-${crypto.randomUUID()}@example.test`,password:'not-a-real-account'}});
 try{
  const makeEvent=(name:string)=>prisma.event.create({data:{name,slug:`test-${crypto.randomUUID()}`,type:'test',venue:'test',location:'test',checkIn:new Date('2030-01-01'),checkOut:new Date('2030-01-03'),status:'active',agentId:agent.id}});
  const a=await makeEvent('isolated event A'),b=await makeEvent('isolated event B');
  const block=await prisma.roomBlock.create({data:{roomType:'Test',rate:100,totalQty:3,eventId:a.id}});
  const other=await prisma.roomBlock.create({data:{roomType:'Test',rate:200,totalQty:2,eventId:b.id}});
  const bad=await post({eventId:a.id,roomBlockId:other.id,guestName:'wrong event'});assert.equal(bad.status,400);
  assert.equal((await prisma.roomBlock.findUniqueOrThrow({where:{id:other.id}})).bookedQty,0);
  const results=await Promise.all(Array.from({length:10},(_,i)=>post({eventId:a.id,roomBlockId:block.id,guestName:`Guest ${i}`})));
  const counts=results.reduce<Record<string,number>>((x,r)=>(x[r.status]=(x[r.status]||0)+1,x),{});console.log('Concurrent result codes:',counts);
  assert.equal(results.filter(r=>r.status===200).length,3);assert.equal(results.filter(r=>r.status===400).length,7);
  assert.equal((await prisma.roomBlock.findUniqueOrThrow({where:{id:block.id}})).bookedQty,3);
  assert.equal(await prisma.booking.count({where:{eventId:a.id}}),3);
  assert.equal(await prisma.guest.count({where:{eventId:a.id}}),3);
  assert.equal(await prisma.activityLog.count({where:{eventId:a.id,action:'booking_created'}}),3);
  assert.ok(results.filter(r=>r.status===200).every(r=>r.body.success));
  const extra=await prisma.roomBlock.create({data:{roomType:'Email test',rate:100,totalQty:20,eventId:a.id}});
  // Force a Prisma type error after the tentative reservation; transaction must roll back.
  const rollback=await post({eventId:a.id,roomBlockId:extra.id,guestName:'Rollback probe',specialRequests:{invalid:true}});
  assert.equal(rollback.status,500);
  assert.equal((await prisma.roomBlock.findUniqueOrThrow({where:{id:extra.id}})).bookedQty,0);
  assert.equal(await prisma.guest.count({where:{eventId:a.id,name:'Rollback probe'}}),0);
  const dup=await Promise.all(Array.from({length:6},(_,i)=>post({eventId:a.id,roomBlockId:extra.id,guestName:`Same ${i}`,guestEmail:i%2?' SAME@EXAMPLE.TEST ':'same@example.test'})));
  console.log('Concurrent duplicate codes:',dup.map(r=>r.status));
  assert.equal(dup.filter(r=>r.status===200).length,1);assert.equal(dup.filter(r=>r.status===409).length,5);
  assert.equal((await prisma.roomBlock.findUniqueOrThrow({where:{id:extra.id}})).bookedQty,1);
  console.log('PASS: event isolation, concurrent capacity, duplicate email and audit consistency');
 }finally{await prisma.event.deleteMany({where:{agentId:agent.id}});await prisma.agent.delete({where:{id:agent.id}});await prisma.$disconnect()}
}
main().catch(async e=>{console.error(e);await prisma.$disconnect();process.exitCode=1});
