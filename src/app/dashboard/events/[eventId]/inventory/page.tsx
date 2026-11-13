import Link from "next/link";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { InventoryOptimizer } from "@/components/dashboard/inventory-optimizer";
import { Hotel, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      roomBlocks: true,
      addOns: true,
      guests: { select: { id: true } },
    },
  });

  if (!event) return notFound();

  const totalRooms = event.roomBlocks.reduce((s, r) => s + r.totalQty, 0);
  const bookedRooms = event.roomBlocks.reduce((s, r) => s + r.bookedQty, 0);
  const totalValue = event.roomBlocks.reduce((s, r) => s + r.rate * r.totalQty, 0);
  const bookedValue = event.roomBlocks.reduce((s, r) => s + r.rate * r.bookedQty, 0);
  const initialDemand = Math.max(
    bookedRooms,
    event.expectedPax ? Math.ceil(event.expectedPax / 2.2) : 0,
    Math.ceil(event.guests.length / 2.2),
    1,
  );
  const defaultBudget = Math.max(
    100000,
    event.roomBlocks.reduce((sum, room) => sum + room.rate * Math.max(1, Math.ceil(room.totalQty * 0.1)), 0),
  );

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gray-900 dark:hover:text-zinc-100 transition-colors mb-4 group">
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to {event.name}
      </Link>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Hotel className="h-6 w-6 text-blue-600" /> Room Inventory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage room blocks for {event.name}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Rooms</p>
            <p className="text-2xl font-bold mt-1">{totalRooms}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Booked</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{bookedRooms}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Available</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{totalRooms - bookedRooms}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Revenue Potential</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalValue)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(bookedValue)} confirmed</p>
          </CardContent>
        </Card>
      </div>

      <InventoryOptimizer
        eventName={event.name}
        initialDemand={initialDemand}
        defaultBudget={defaultBudget}
        options={event.roomBlocks.map((room) => ({
          id: room.id,
          roomType: room.roomType,
          supplier: room.hotelName || "Unspecified supplier",
          buyRate: room.rate,
          currentBlock: room.totalQty,
          booked: room.bookedQty,
        }))}
      />

      {/* Room Blocks */}
      <div className="grid gap-4">
        {event.roomBlocks.map((room) => {
          const pct = room.totalQty > 0 ? Math.round((room.bookedQty / room.totalQty) * 100) : 0;
          const available = room.totalQty - room.bookedQty;
          return (
            <Card key={room.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{room.roomType}</h3>
                    {room.hotelName && (
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{room.hotelName}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {room.floor && `Floor ${room.floor}`}
                      {room.wing && ` • ${room.wing}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{formatCurrency(room.rate)}</p>
                    <p className="text-xs text-muted-foreground">per night</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Occupancy</span>
                      <span className="font-medium">{room.bookedQty}/{room.totalQty} ({pct}%)</span>
                    </div>
                    <Progress
                      value={pct}
                      indicatorClassName={pct > 80 ? "bg-green-500" : pct > 50 ? "bg-blue-500" : "bg-amber-500"}
                    />
                  </div>
                  <Badge variant={available === 0 ? "destructive" : available < 5 ? "warning" : "success"}>
                    {available === 0 ? "Sold Out" : `${available} left`}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add-Ons Section */}
      {event.addOns.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Add-Ons & Inclusions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {event.addOns.map((addon) => (
                <div
                  key={addon.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-zinc-800"
                >
                  <div>
                    <p className="font-medium text-sm">{addon.name}</p>
                    {addon.description && (
                      <p className="text-xs text-muted-foreground">{addon.description}</p>
                    )}
                  </div>
                  <Badge variant={addon.isIncluded ? "success" : "outline"}>
                    {addon.isIncluded ? "Included" : formatCurrency(addon.price)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
