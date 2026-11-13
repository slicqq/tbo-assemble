import prisma from "@/lib/db";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | TBO Assemble",
};

export default async function DashboardPage() {
  const events = await prisma.event.findMany({
    include: {
      roomBlocks: true,
      guests: { select: { id: true, status: true, name: true } },
      bookings: { select: { id: true, totalAmount: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize events for client component
  const serializedEvents = events.map((event) => ({
    id: event.id,
    name: event.name,
    slug: event.slug,
    type: event.type,
    status: event.status,
    venue: event.venue,
    location: event.location,
    checkIn: event.checkIn.toISOString(),
    checkOut: event.checkOut.toISOString(),
    primaryColor: event.primaryColor,
    totalRooms: event.roomBlocks.reduce((s, r) => s + r.totalQty, 0),
    bookedRooms: event.roomBlocks.reduce((s, r) => s + r.bookedQty, 0),
    guestCount: event.guests.length,
    confirmedGuests: event.guests.filter((g) => g.status === "confirmed").length,
    totalRevenue: event.bookings.reduce((s, b) => s + b.totalAmount, 0),
    guestNames: event.guests.slice(0, 6).map((g) => g.name),
  }));

  // Cumulative revenue and booking count across all events, bucketed for sparklines
  const allBookings = events
    .flatMap((e) => e.bookings)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const buckets = 12;
  const trends = { revenue: [] as number[], bookings: [] as number[] };
  if (allBookings.length > 0) {
    let running = 0;
    const cumulative = allBookings.map((b) => (running += b.totalAmount));
    for (let i = 1; i <= buckets; i++) {
      const idx = Math.max(0, Math.ceil((i / buckets) * allBookings.length) - 1);
      trends.revenue.push(cumulative[idx]);
      trends.bookings.push(idx + 1);
    }
  }

  return (
    <div>
      <DashboardHeader />

      <DashboardClient initialEvents={serializedEvents} trends={trends} />
    </div>
  );
}
