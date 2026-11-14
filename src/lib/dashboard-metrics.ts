// Stay dates are stored without a property timezone. Compare their UTC calendar dates;
// checkout is exclusive. This is a display convention, not a hotel-local clock.
export function stayPhase(checkIn: string | Date, checkOut: string | Date, now = new Date()) {
  const day = (value: string | Date) => new Date(value).toISOString().slice(0, 10);
  const today = day(now), start = day(checkIn), end = day(checkOut);
  if (today < start) return 'upcoming' as const;
  if (today >= end) return 'past' as const;
  return 'in stay' as const;
}

export function summarizeEvent<T extends {
  id: string; name: string; slug: string; type: string; status: string; venue: string;
  location: string; checkIn: Date; checkOut: Date; primaryColor: string;
  roomBlocks: { totalQty: number; bookedQty: number }[];
  guests: { name: string; status: string }[];
  bookings: { totalAmount: number; status: string }[];
}>(event: T) {
  const bookings = event.bookings.filter(b => b.status !== 'cancelled');
  return {
    id: event.id, name: event.name, slug: event.slug, type: event.type, status: event.status,
    venue: event.venue, location: event.location, checkIn: event.checkIn.toISOString(),
    checkOut: event.checkOut.toISOString(), primaryColor: event.primaryColor,
    totalRooms: event.roomBlocks.reduce((s, r) => s + r.totalQty, 0),
    bookedRooms: event.roomBlocks.reduce((s, r) => s + r.bookedQty, 0),
    guestCount: event.guests.length,
    confirmedGuests: event.guests.filter(g => g.status === 'confirmed').length,
    totalRevenue: bookings.reduce((s, b) => s + b.totalAmount, 0),
    bookingCount: bookings.length,
    guestNames: event.guests.slice(0, 6).map(g => g.name),
  };
}

export function utcDaysUntil(value: string | Date, now = new Date()): number {
  const day = (date: string | Date) => Date.parse(new Date(date).toISOString().slice(0, 10) + 'T00:00:00Z');
  return Math.round((day(value) - day(now)) / 86400000);
}

export function formatStayDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
}
