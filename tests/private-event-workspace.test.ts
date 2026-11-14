import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parsePrivateRoom,validWorkspaceId} from '../src/lib/private-event-workspace';
function room(hotel='Example hotel',type='Double',qty='4',rate='25.50'){const f=new FormData();f.set('hotel_name',hotel);f.set('room_type',type);f.set('total_qty',qty);f.set('rate',rate);return f}
test('private room input has strict bounded integer quantity and decimal rate',()=>{
 assert.deepEqual(parsePrivateRoom(room()).value,{hotel_name:'Example hotel',room_type:'Double',total_qty:4,rate:25.5});
 for(const q of ['0','-1','1.5','10001','', 'NaN'])assert.equal(parsePrivateRoom(room('Hotel','Double',q)).value,null,q);
 for(const p of ['-1','1.111','10000001','1e5','', 'Infinity'])assert.equal(parsePrivateRoom(room('Hotel','Double','2',p)).value,null,p);
 assert.equal(parsePrivateRoom(room(' ','Double')).value,null);assert.equal(parsePrivateRoom(room('x'.repeat(121),'Double')).value,null);
 assert.equal(validWorkspaceId('a0000000-0000-4000-8000-000000000001'),true);assert.equal(validWorkspaceId('not-a-uuid'),false);
});
