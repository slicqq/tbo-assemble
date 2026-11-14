import prisma from "@/lib/db";
import { summarizeEvent } from "@/lib/dashboard-metrics";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { DashboardHeader, InventoryDecisionBanner } from "@/components/dashboard/dashboard-header";
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
      bookings: { select: { id: true, totalAmount: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedEvents = events.map(summarizeEvent);

  return (
    <div>
      <DashboardHeader />

      <InventoryDecisionBanner />
      <DashboardClient initialEvents={serializedEvents} />
    </div>
  );
}
