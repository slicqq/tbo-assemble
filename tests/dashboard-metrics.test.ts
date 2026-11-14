import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { stayPhase, utcDaysUntil, summarizeEvent, formatStayDate } from '../src/lib/dashboard-metrics';

test('stay phase uses UTC dates and excludes checkout', () => {
  const checkIn = '2026-04-10T00:00:00.000Z', checkOut = '2026-04-13T00:00:00.000Z';
  assert.equal(stayPhase(checkIn, checkOut, new Date('2026-04-09T23:59:59Z')), 'upcoming');
  assert.equal(stayPhase(checkIn, checkOut, new Date('2026-04-10T00:00:00Z')), 'in stay');
  assert.equal(stayPhase(checkIn, checkOut, new Date('2026-04-12T23:59:59Z')), 'in stay');
  assert.equal(stayPhase(checkIn, checkOut, new Date('2026-04-13T00:00:00Z')), 'past');
  assert.equal(utcDaysUntil(checkIn, new Date('2026-04-09T23:59:59Z')), 1);
  assert.match(formatStayDate(checkIn), /10 Apr 2026/);
});

test('summary keeps bookings, guests and room counters separate and excludes cancelled amounts', () => {
  const event = { id: '1', name:'Example', slug:'example', type:'wedding', status:'draft', venue:'Venue', location:'City', checkIn: new Date('2026-04-10'), checkOut: new Date('2026-04-13'), primaryColor:'#000', roomBlocks:[{totalQty: 10, bookedQty: 3}], guests:[{name:'A',status:'confirmed'},{name:'B',status:'declined'}], bookings:[{status:'confirmed',totalAmount:900},{status:'cancelled',totalAmount:300},{status:'pending',totalAmount:100}] };
  const summary = summarizeEvent(event);
  assert.equal(summary.totalRevenue, 1000);
  assert.equal(summary.bookingCount, 2);
  assert.equal(summary.bookedRooms, 3);
  assert.equal(summary.guestCount, 2);
  assert.equal(summary.confirmedGuests, 1);
  assert.deepEqual(summary.guestNames, ['A','B']);
});
