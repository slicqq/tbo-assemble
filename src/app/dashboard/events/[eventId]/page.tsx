import Link from "next/link";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatCurrency } from "@/lib/utils";
import { photoFor } from "@/lib/photos";
import { Illustration } from "@/components/ui/illustration";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { EventOverviewActions } from "./overview-actions";
import {
  Hotel,
  Users,
  Calendar,
  MapPin,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock,
  BarChart3,
} from "lucide-react";
import { DiscountRulesClient } from "@/components/dashboard/discount-rules-client";
import { EventEditForm } from "@/components/dashboard/event-edit-form";

export const dynamic = "force-dynamic";

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      roomBlocks: true,
      guests: true,
      bookings: true,
      addOns: true,
      attritionRules: { orderBy: { releaseDate: "asc" } },
      discountRules: { orderBy: { minRooms: "asc" } },
    },
  });

  if (!event) return notFound();

  const totalRooms = event.roomBlocks.reduce((s, r) => s + r.totalQty, 0);
  const bookedRooms = event.roomBlocks.reduce((s, r) => s + r.bookedQty, 0);
  const occupancyPct = totalRooms > 0 ? Math.round((bookedRooms / totalRooms) * 100) : 0;
  const totalRevenue = event.bookings.reduce((s, b) => s + b.totalAmount, 0);
  const confirmedGuests = event.guests.filter((g) => g.status === "confirmed").length;
  const invitedGuests = event.guests.filter((g) => g.status === "invited").length;

  const nextRelease = event.attritionRules.find((r) => !r.isTriggered);
  const cover = photoFor(event);

  return (
    <div className="animate-fade-in">
      {/* Back Button */}
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gray-900 dark:hover:text-zinc-100 transition-colors mb-4 group">
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Dashboard
      </Link>

      {/* Event header — destination cover */}
      <Card className="mb-6 overflow-hidden">
        <div className="relative h-44 bg-muted sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover.src} alt={cover.alt} className="absolute inset-0 size-full object-cover" />
          <div className="photo-scrim-strong absolute inset-0" />
          <div className="absolute inset-x-5 bottom-5 flex flex-wrap items-end justify-between gap-3 text-white sm:inset-x-6">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold capitalize text-black">
                  <span className={`size-1.5 rounded-full ${event.status === "active" ? "bg-emerald-500" : event.status === "draft" ? "bg-amber-500" : event.status === "cancelled" ? "bg-red-500" : "bg-neutral-400"}`} />
                  {event.status}
                </span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider backdrop-blur-sm">{event.type}</span>
              </div>
              <h1 className="truncate text-3xl font-bold sm:text-4xl">{event.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
                <span className="flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0" />{event.venue}, {event.location}</span>
                <span className="flex items-center gap-1.5"><Calendar className="size-3.5 shrink-0" />{formatDate(event.checkIn)} – {formatDate(event.checkOut)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-surface/60 px-4 py-3">
          <EventEditForm
            eventId={eventId}
            initialData={{
              name: event.name,
              venue: event.venue,
              location: event.location,
              checkIn: event.checkIn.toISOString(),
              checkOut: event.checkOut.toISOString(),
              type: event.type,
              description: event.description || '',
              primaryColor: event.primaryColor,
              secondaryColor: event.secondaryColor,
              accentColor: event.accentColor,
            }}
          />
          <EventOverviewActions slug={event.slug} eventId={eventId} currentStatus={event.status} eventName={event.name} />
          <Link href={`/event/${event.slug}`} target="_blank">
            <Button size="sm" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> Guest microsite
            </Button>
          </Link>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Room Occupancy</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                <Hotel className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{occupancyPct}%</p>
            <Progress value={occupancyPct} className="mt-3 h-2" indicatorClassName={occupancyPct > 80 ? "bg-gradient-to-r from-emerald-500 to-teal-500" : occupancyPct > 50 ? "bg-gradient-to-r from-blue-500 to-indigo-500" : "bg-gradient-to-r from-amber-500 to-orange-500"} />
            <p className="text-xs text-muted-foreground mt-2">{bookedRooms}/{totalRooms} rooms booked</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Guests</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{confirmedGuests}</p>
            <p className="text-xs text-muted-foreground mt-4">{invitedGuests} pending confirmation</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Revenue</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-4">From {event.bookings.length} bookings</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden relative">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Attrition Risk</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            {nextRelease ? (
              <>
                <p className="text-2xl font-semibold tracking-tight tabular-nums text-amber-600">
                  {nextRelease.releasePercent}%
                </p>
                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Releases {formatDate(nextRelease.releaseDate)}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold tracking-tight tabular-nums text-emerald-600">Safe</p>
                <p className="text-xs text-muted-foreground mt-4">No pending releases</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href={`/dashboard/events/${eventId}/guests`}>
          <Card className="hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Illustration name="followers" className="size-14 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground transition-colors">Guest List</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{event.guests.length} guests total</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/dashboard/events/${eventId}/inventory`}>
          <Card className="hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Illustration name="bed" className="size-14 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground transition-colors">Room Inventory</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{event.roomBlocks.length} room types configured</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/dashboard/events/${eventId}/allocator`}>
          <Card className="hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Illustration name="building" className="size-14 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground transition-colors">Visual Allocator</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Drag-and-drop guest placement</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/dashboard/events/${eventId}/attrition`}>
          <Card className="hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Illustration name="vault" className="size-14 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground transition-colors">Attrition Dashboard</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{event.attritionRules.length} release rules</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* New Feature Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href={`/dashboard/events/${eventId}/rfp`}>
          <Card className="hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Illustration name="dotted-notebook" className="size-14 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground transition-colors">RFP Dashboard</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Compare vendor quotes</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/dashboard/events/${eventId}/schedule`}>
          <Card className="hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Illustration name="coffee" className="size-14 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground transition-colors">Event Schedule</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Day-wise agenda & costing</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/dashboard/events/${eventId}/rooms`}>
          <Card className="hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Illustration name="bedroom" className="size-14 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground transition-colors">Room Assignments</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Multi-guest per room</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/dashboard/events/${eventId}/pax`}>
          <Card className="hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Illustration name="calculator" className="size-14 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground transition-colors">Pax & Quotes</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Dynamic pricing & PDF quote</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Room Blocks Summary */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
              <Hotel className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold">Room Blocks</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Room Type</th>
                  <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Rate/Night</th>
                  <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Available</th>
                  <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Booked</th>
                  <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {event.roomBlocks.map((room) => {
                  const pct = room.totalQty > 0 ? Math.round((room.bookedQty / room.totalQty) * 100) : 0;
                  return (
                    <tr key={room.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-4 font-medium text-foreground">{room.roomType}</td>
                      <td className="px-5 py-4 text-foreground">{formatCurrency(room.rate)}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          {room.totalQty - room.bookedQty}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-foreground">{room.bookedQty}/{room.totalQty}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Progress value={pct} className="w-24 h-2" />
                          <span className="text-xs font-medium text-muted-foreground w-8">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Forecast Widget */}
      <div className="mt-8">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Revenue Forecast</CardTitle>
                <p className="text-[10px] text-muted-foreground">Projected revenue at full occupancy vs. current</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {(() => {
              const nights = Math.ceil(
                (new Date(event.checkOut).getTime() - new Date(event.checkIn).getTime()) / (1000 * 60 * 60 * 24)
              );
              const maxRevenue = event.roomBlocks.reduce((s, r) => s + r.totalQty * r.rate * nights, 0);
              const currentRevenue = totalRevenue;
              const projectedRevenue = totalRooms > 0
                ? Math.round((bookedRooms / totalRooms) * maxRevenue * 1.1)
                : 0;
              const revenuePercent = maxRevenue > 0 ? Math.round((currentRevenue / maxRevenue) * 100) : 0;

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Revenue</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(currentRevenue)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{revenuePercent}% of potential</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Projected (at trend)</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(projectedRevenue)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Based on current pace</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Max Potential</p>
                    <p className="text-2xl font-bold text-muted-foreground">{formatCurrency(maxRevenue)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{totalRooms} rooms × {nights} nights</p>
                  </div>
                </div>
              );
            })()}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Revenue progress</span>
                <span>{formatCurrency(totalRevenue)} / {formatCurrency(
                  event.roomBlocks.reduce((s, r) => s + r.totalQty * r.rate * Math.ceil((new Date(event.checkOut).getTime() - new Date(event.checkIn).getTime()) / (1000 * 60 * 60 * 24)), 0)
                )}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                  style={{
                    width: `${Math.min(
                      100,
                      (() => {
                        const nights = Math.ceil(
                          (new Date(event.checkOut).getTime() - new Date(event.checkIn).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const maxRevenue = event.roomBlocks.reduce((s, r) => s + r.totalQty * r.rate * nights, 0);
                        return maxRevenue > 0 ? Math.round((totalRevenue / maxRevenue) * 100) : 0;
                      })()
                    )}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discount Rules */}
      <div className="mt-8">
        <DiscountRulesClient
          eventId={eventId}
          initialRules={event.discountRules.map((r) => ({
            id: r.id,
            minRooms: r.minRooms,
            discountPct: r.discountPct,
            description: r.description,
            isActive: r.isActive,
          }))}
        />
      </div>

      {/* Analytics Charts */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
            <BarChart3 className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        </div>
        <AnalyticsCharts
          roomBlocks={event.roomBlocks.map(r => ({
            id: r.id,
            roomType: r.roomType,
            totalQty: r.totalQty,
            bookedQty: r.bookedQty,
            rate: r.rate,
          }))}
          guests={event.guests.map(g => ({
            status: g.status,
            group: g.group,
          }))}
          bookings={event.bookings.map(b => ({
            totalAmount: b.totalAmount,
            createdAt: b.createdAt.toISOString(),
          }))}
          eventColor={event.primaryColor}
        />
      </div>
    </div>
  );
}
