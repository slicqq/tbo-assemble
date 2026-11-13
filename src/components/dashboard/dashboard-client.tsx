"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkline } from "@/components/ui/sparkline";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { photoFor } from "@/lib/photos";
import { StatCard, IconChip } from "@/components/system";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  Search,
  Calendar,
  MapPin,
  Users,
  Hotel,
  Plus,
  ArrowRight,
  Loader2,
  RefreshCw,
  Copy,
  Globe,
  RotateCcw,
  Play,
  AlertTriangle,
  IndianRupee,
  Zap,
  LayoutGrid,
  List,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Event {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  venue: string;
  location: string;
  checkIn: string;
  checkOut: string;
  primaryColor: string;
  totalRooms: number;
  bookedRooms: number;
  guestCount: number;
  confirmedGuests: number;
  totalRevenue: number;
  guestNames?: string[];
}

interface DashboardClientProps {
  initialEvents: Event[];
  trends?: { revenue: number[]; bookings: number[] };
}

export function DashboardClient({ initialEvents, trends = { revenue: [], bookings: [] } }: DashboardClientProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [copyToast, setCopyToast] = useState("");
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoNotifications, setDemoNotifications] = useState<{ id: number; text: string; type: string }[]>([]);
  const [visibleCount, setVisibleCount] = useState(6);
  
  // Set initial timestamp after mount to avoid hydration mismatch
  useEffect(() => {
    setLastRefresh(new Date());
  }, []);

  // Auto-refresh every 30 seconds
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const allEvents = await res.json();
        const mapped = allEvents.map((event: Record<string, unknown>) => ({
          id: event.id,
          name: event.name,
          slug: event.slug,
          type: event.type,
          status: event.status,
          venue: event.venue,
          location: event.location,
          checkIn: event.checkIn,
          checkOut: event.checkOut,
          primaryColor: event.primaryColor,
          totalRooms: (event.roomBlocks as { totalQty: number }[])?.reduce((s: number, r: { totalQty: number }) => s + r.totalQty, 0) || 0,
          bookedRooms: (event.roomBlocks as { bookedQty: number }[])?.reduce((s: number, r: { bookedQty: number }) => s + r.bookedQty, 0) || 0,
          guestCount: (event.guests as unknown[])?.length || 0,
          confirmedGuests: (event.guests as { status: string }[])?.filter((g: { status: string }) => g.status === "confirmed").length || 0,
          totalRevenue: (event.bookings as { totalAmount: number }[])?.reduce((s: number, b: { totalAmount: number }) => s + b.totalAmount, 0) || 0,
        }));
        setEvents(mapped);
        setLastRefresh(new Date());
      } else {
        console.error("Failed to refresh events:", res.status);
      }
    } catch (err) {
      console.error("Network error refreshing events:", err);
      // Don't show error for auto-refresh, only manual
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Listen for cross-tab booking notifications (from microsite)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    
    const channel = new BroadcastChannel('tbo-bookings');
    channel.onmessage = (event) => {
      if (event.data?.type === 'new-booking') {
        // Auto-refresh dashboard when a booking is made in another tab
        refreshData();
      }
    };
    
    return () => channel.close();
  }, [refreshData]);

  // Reset demo data
  const resetDemo = useCallback(async () => {
    if (!confirm("This will reset all demo data. Continue?")) return;
    setResettingDemo(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        await refreshData();
      }
    } catch {
      // silent fail
    } finally {
      setResettingDemo(false);
    }
  }, [refreshData]);

  // Live Demo Mode — simulate bookings with animated notifications
  const runLiveDemo = useCallback(async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    setDemoStep(0);
    setDemoNotifications([]);

    const demoGuests = [
      { name: "Priya Sharma", group: "Bride Side", room: "Deluxe King" },
      { name: "Rahul Mehta", group: "Groom Side", room: "Premium Suite" },
      { name: "Anita Desai", group: "VIP", room: "Deluxe Twin" },
      { name: "Vikram Singh", group: "Family", room: "Deluxe King" },
    ];

    for (let i = 0; i < demoGuests.length; i++) {
      setDemoStep(i + 1);
      const guest = demoGuests[i];

      const notifId = Date.now();
      setDemoNotifications((prev) => [
        { id: notifId, text: `🎉 ${guest.name} booked ${guest.room} (${guest.group})`, type: "booking" },
        ...prev.slice(0, 3),
      ]);

      try {
        const eventsRes = await fetch("/api/events");
        if (eventsRes.ok) {
          const allEvents = await eventsRes.json();
          if (allEvents.length > 0) {
            const evt = allEvents[0];
            const rooms = evt.roomBlocks || [];
            const availableRoom = rooms.find((r: { totalQty: number; bookedQty: number }) => r.totalQty - r.bookedQty > 0);
            if (availableRoom) {
              await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  eventId: evt.id,
                  roomBlockId: availableRoom.id,
                  guestName: guest.name,
                  guestEmail: `${guest.name.toLowerCase().replace(/\s/g, ".")}@demo.com`,
                  guestPhone: `+91 98765 ${String(43210 + i).slice(0, 5)}`,
                  guestGroup: guest.group,
                  selectedAddOns: [],
                  totalAmount: availableRoom.rate * 2,
                }),
              });
            }
          }
        }
      } catch {
        // Continue demo
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    await refreshData();
    setDemoNotifications((prev) => [
      { id: Date.now(), text: "✅ Live demo complete — 4 bookings simulated!", type: "success" },
      ...prev.slice(0, 3),
    ]);
    setTimeout(() => setDemoNotifications([]), 5000);
    setDemoRunning(false);
    setDemoStep(0);
  }, [demoRunning, refreshData]);

  useEffect(() => {
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search and filter
  useEffect(() => {
    const searchEvents = async () => {
      if (!debouncedSearch && statusFilter === "all" && typeFilter === "all") {
        setEvents(initialEvents);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (typeFilter !== "all") params.set("type", typeFilter);

        const res = await fetch(`/api/events/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    searchEvents();
  }, [debouncedSearch, statusFilter, typeFilter, initialEvents]);



  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success" as const;
      case "draft":
        return "secondary" as const;
      case "completed":
        return "outline" as const;
      case "cancelled":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      wedding: "Wedding",
      conference: "Conference",
      corporate: "Corporate",
      social: "Social Event",
      mice: "MICE",
    };
    return labels[type] || type;
  };

  // Calculate totals (memoized)
  const { totalRevenue, totalGuests, totalRooms, bookedRooms } = useMemo(() => ({
    totalRevenue: events.reduce((s, e) => s + e.totalRevenue, 0),
    totalGuests: events.reduce((s, e) => s + e.guestCount, 0),
    totalRooms: events.reduce((s, e) => s + e.totalRooms, 0),
    bookedRooms: events.reduce((s, e) => s + e.bookedRooms, 0),
  }), [events]);

  const occupancyPct = totalRooms > 0 ? Math.round((bookedRooms / totalRooms) * 100) : 0;
  const revenueAtRisk = events.reduce((s, e) => {
    const unsold = e.totalRooms - e.bookedRooms;
    const avgRate = e.totalRevenue > 0 && e.bookedRooms > 0 ? e.totalRevenue / e.bookedRooms : 5000;
    return s + unsold * avgRate;
  }, 0);
  const filtersActive = Boolean(searchTerm) || statusFilter !== "all" || typeFilter !== "all";
  const confirmedTotal = events.reduce((s, e) => s + e.confirmedGuests, 0);
  const allGuestNames = events.flatMap((e) => e.guestNames ?? []);
  const typeMix = Object.entries(
    events.reduce<Record<string, number>>((acc, e) => ((acc[e.type] = (acc[e.type] ?? 0) + 1), acc), {})
  ).sort((a, b) => b[1] - a[1]);
  // Data colours come from the chart palette tokens
  const TYPE_DOT: Record<string, string> = { wedding: "bg-chart-1", mice: "bg-chart-2", conference: "bg-chart-2", corporate: "bg-chart-4", social: "bg-chart-3" };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/event/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyToast("Link copied!");
      setTimeout(() => setCopyToast(""), 2000);
    });
  };
  const cloneEvent = (event: Event) => {
    fetch(`/api/events/${event.id}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${event.name} (Copy)` }),
    }).then(() => refreshData());
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* KPIs — StatCard primitive: label, value, caption, one fixed-height visual */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="stats-overview">
        <StatCard
          label="Total revenue"
          icon={IndianRupee}
          value={totalRevenue > 0 ? <AnimatedCounter value={totalRevenue} prefix="₹" formatter={(n) => n.toLocaleString("en-IN")} /> : <span className="text-muted-foreground">₹0</span>}
          caption={`${trends.bookings.at(-1) ?? 0} bookings to date`}
          visual={<Sparkline data={trends.revenue} className="h-12 w-full" />}
        />
        <StatCard
          label="Room occupancy"
          icon={Hotel}
          value={<AnimatedCounter value={occupancyPct} suffix="%" />}
          caption={`${bookedRooms} of ${totalRooms} rooms booked`}
          visual={
            <div className="flex w-full gap-0.5" role="img" aria-label={`${occupancyPct}% occupancy`}>
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} className={`h-5 flex-1 rounded-[3px] ${i < Math.round((occupancyPct / 100) * 24) ? "bg-chart-2" : "bg-muted"}`} />
              ))}
            </div>
          }
        />
        <StatCard
          label="Guests"
          icon={Users}
          value={<AnimatedCounter value={totalGuests} />}
          caption={`${confirmedTotal} confirmed · ${totalGuests - confirmedTotal} pending`}
          visual={
            <div className="flex w-full items-center justify-between">
              <AvatarStack names={allGuestNames} max={5} />
              <span className="text-xs font-medium tabular-nums text-muted-foreground">{totalGuests > 0 ? Math.round((confirmedTotal / totalGuests) * 100) : 0}% RSVP</span>
            </div>
          }
        />
        <StatCard
          label="Events"
          icon={Calendar}
          value={<AnimatedCounter value={events.length} />}
          caption={`${events.filter((e) => e.status === "active").length} active right now`}
          visual={
            <div className="w-full">
              <div className="flex h-2 overflow-hidden rounded-full">
                {typeMix.map(([t, n]) => (
                  <span key={t} className={TYPE_DOT[t] ?? "bg-neutral-400"} style={{ width: `${(n / Math.max(events.length, 1)) * 100}%` }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {typeMix.map(([t, n]) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${TYPE_DOT[t] ?? "bg-neutral-400"}`} />{getTypeLabel(t)} {n}
                  </span>
                ))}
              </div>
            </div>
          }
        />
      </div>

      {/* Inventory health + demo */}
      {(totalRooms - bookedRooms > 0 || demoRunning) && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Revenue at risk</p>
                  <p className="mt-3 text-[1.75rem] font-semibold leading-none tabular-nums tracking-tight text-red-600 dark:text-red-500">
                    ₹{revenueAtRisk.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Unsold rooms × average booked rate, across all room blocks</p>
                </div>
                <Badge variant="destructive">{totalRooms - bookedRooms} rooms unsold</Badge>
              </div>
              <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-red-100 dark:bg-red-500/20" role="img" aria-label={`${occupancyPct}% of rooms secured`}>
                <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${occupancyPct}%` }} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> Secured <span className="font-medium tabular-nums text-foreground">{bookedRooms}</span></span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-300 dark:bg-red-500/50" /> At risk <span className="font-medium tabular-nums text-foreground">{totalRooms - bookedRooms}</span></span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full flex-col p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Live demo mode</p>
                <IconChip icon={Zap} className="size-8" />
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed">
                Generate 4 realistic bookings with live notifications to showcase the platform.
              </p>
              <Button onClick={runLiveDemo} disabled={demoRunning} className="mt-4 w-full">
                {demoRunning ? <><Loader2 className="animate-spin" /> Simulating… ({demoStep}/4)</> : <><Play /> Run live demo</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Demo notifications */}
      {demoNotifications.length > 0 && (
        <div className="fixed right-4 top-4 z-50 max-w-sm space-y-2">
          {demoNotifications.map((notif) => (
            <div key={notif.id} className="animate-in fade-in slide-in-from-right-5 rounded-lg border bg-popover px-4 py-3 text-sm shadow-lg">
              {notif.text}
            </div>
          ))}
        </div>
      )}

      {/* Events */}
      <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table")} className="gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Your events</h2>
            <p className="text-sm text-muted-foreground">
              {events.length} event{events.length === 1 ? "" : "s"}{filtersActive ? " match your filters" : ""} · updated {lastRefresh ? lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refreshData} disabled={refreshing} title="Refresh data" aria-label="Refresh dashboard data">
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </Button>
            <Button variant="outline" onClick={resetDemo} disabled={resettingDemo} title="Reset demo data">
              <RotateCcw className={resettingDemo ? "animate-spin" : ""} />
              {resettingDemo ? "Resetting…" : "Reset demo"}
            </Button>
            <Button asChild>
              <Link href="/dashboard/onboarding"><Plus /> New event</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search events, venues, locations…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" aria-label="Search events" />
            {loading && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
          </NativeSelect>
          <NativeSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type">
            <option value="all">All types</option>
            <option value="wedding">Wedding</option>
            <option value="conference">Conference</option>
            <option value="corporate">Corporate</option>
            <option value="social">Social</option>
          </NativeSelect>
          <TabsList className="ml-auto">
            <TabsTrigger value="cards" aria-label="Card view"><LayoutGrid /> Cards</TabsTrigger>
            <TabsTrigger value="table" aria-label="Table view"><List /> Table</TabsTrigger>
          </TabsList>
        </div>

        {events.length === 0 ? (
          <EmptyState
            illustration={filtersActive ? "snail" : "travel-bag"}
            title={filtersActive ? "No events match your filters" : "No events yet"}
            description={filtersActive ? "Try adjusting your search or filter criteria." : "Create your first event with AI-powered contract parsing to get started."}
            action={!filtersActive ? <Button asChild><Link href="/dashboard/onboarding"><Plus /> Create event</Link></Button> : undefined}
          />
        ) : (
          <>
            <TabsContent value="cards">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="events-list">
                {events.slice(0, visibleCount).map((event) => {
                  const occupancy = event.totalRooms > 0 ? Math.round((event.bookedRooms / event.totalRooms) * 100) : 0;
                  const checkIn = new Date(event.checkIn);
                  const checkOut = new Date(event.checkOut);
                  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                  const daysUntil = Math.ceil((checkIn.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isUpcoming = daysUntil > 0;
                  const isOngoing = daysUntil <= 0 && daysUntil > -nights;
                  const img = photoFor(event);
                  const href = `/dashboard/events/${event.id}`;
                  return (
                    <Card key={event.id} className="group overflow-hidden transition-shadow hover:shadow-lg">
                      <Link href={href} className="relative block aspect-[16/8] overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.src} alt={img.alt} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                        <div className="photo-scrim absolute inset-0" />
                        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold capitalize text-black shadow-sm">
                            <span className={`size-1.5 rounded-full ${isOngoing ? "bg-emerald-500" : event.status === "active" ? "bg-emerald-500" : event.status === "draft" ? "bg-amber-500" : "bg-neutral-400"}`} />
                            {isOngoing ? "Live now" : event.status}
                          </span>
                          {isUpcoming && (
                            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">in {daysUntil} days</span>
                          )}
                        </div>
                        <div className="absolute inset-x-4 bottom-3 text-white">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-white/75">{getTypeLabel(event.type)}</p>
                          <p className="flex items-center gap-1 text-sm font-medium"><MapPin className="size-3.5" /> {event.location}</p>
                        </div>
                      </Link>
                      <CardContent className="p-5">
                        <Link href={href} className="block">
                          <h3 className="truncate text-base font-semibold">{event.name}</h3>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">{event.venue} · {formatDate(event.checkIn)} · {nights}N</p>
                        </Link>
                        <dl className="mt-4 grid grid-cols-3 divide-x rounded-lg border bg-surface/60">
                          {[
                            { k: "Guests", v: <>{event.confirmedGuests}<span className="text-muted-foreground">/{event.guestCount}</span></> },
                            { k: "Rooms", v: <>{event.bookedRooms}<span className="text-muted-foreground">/{event.totalRooms}</span></> },
                            { k: "Revenue", v: event.totalRevenue > 0 ? formatCurrency(event.totalRevenue) : <span className="text-muted-foreground">—</span> },
                          ].map((m) => (
                            <div key={m.k} className="px-3 py-2.5">
                              <dt className="text-[11px] text-muted-foreground">{m.k}</dt>
                              <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{m.v}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="mt-4">
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Occupancy</span>
                            <span className="font-medium tabular-nums">{occupancy}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full ${occupancy > 80 ? "bg-emerald-500" : occupancy > 50 ? "bg-amber-500" : "bg-orange-500"}`} style={{ width: `${occupancy}%` }} />
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t pt-4">
                          {(event.guestNames?.length ?? 0) > 0 ? (
                            <AvatarStack names={event.guestNames ?? []} max={4} size="size-6" />
                          ) : (
                            <span className="text-xs text-muted-foreground">No guests yet</span>
                          )}
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => copyLink(event.slug)} title="Copy microsite link" aria-label="Copy event microsite link"><Globe /></Button>
                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => cloneEvent(event)} title="Clone this event" aria-label="Clone event"><Copy /></Button>
                            <Button asChild variant="outline" size="sm" className="ml-1"><Link href={href}>Open <ArrowRight /></Link></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="table">
              <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Event</TableHead>
                <TableHead className="hidden md:table-cell">Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Guests</TableHead>
                <TableHead className="hidden sm:table-cell">Occupancy</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="w-[1%] pr-4"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.slice(0, visibleCount).map((event) => {
                const occupancy = event.totalRooms > 0 ? Math.round((event.bookedRooms / event.totalRooms) * 100) : 0;
                const checkIn = new Date(event.checkIn);
                const checkOut = new Date(event.checkOut);
                const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                const daysUntil = Math.ceil((checkIn.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const isUpcoming = daysUntil > 0;
                const isOngoing = daysUntil <= 0 && daysUntil > -nights;
                const href = `/dashboard/events/${event.id}`;

                return (
                  <TableRow key={event.id} className="group">
                    <TableCell className="max-w-[320px] pl-4">
                      <Link href={href} className="flex items-center gap-3">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: event.primaryColor }} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:underline underline-offset-4">{event.name}</span>
                          <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" /> {event.venue}, {event.location}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">
                      <p>{formatDate(event.checkIn)}</p>
                      <p className="text-xs text-muted-foreground">
                        {nights} night{nights === 1 ? "" : "s"}{isUpcoming ? ` · in ${daysUntil}d` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={getStatusVariant(event.status)}>
                          {isOngoing && <span className="size-1.5 rounded-full bg-current" />}
                          {isOngoing ? "Live" : event.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{getTypeLabel(event.type)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">
                      {event.confirmedGuests}<span className="text-muted-foreground"> / {event.guestCount}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-primary/10">
                          <div
                            className={`h-full rounded-full ${occupancy > 80 ? "bg-emerald-500" : occupancy > 50 ? "bg-amber-500" : "bg-primary/70"}`}
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{event.bookedRooms}/{event.totalRooms}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {event.totalRevenue > 0 ? formatCurrency(event.totalRevenue) : <span className="font-normal text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={() => copyLink(event.slug)}
                          title="Copy microsite link"
                          aria-label="Copy event microsite link"
                        >
                          <Globe />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={() => cloneEvent(event)}
                          title="Clone this event"
                          aria-label="Clone event"
                        >
                          <Copy />
                        </Button>
                        <Button asChild variant="ghost" size="icon" className="size-8 text-muted-foreground">
                          <Link href={href} aria-label={`Open ${event.name}`}><ArrowRight /></Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
              </Card>
            </TabsContent>
          </>
        )}

        {events.length > 0 && (events.length > visibleCount || visibleCount > 6) && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {Math.min(visibleCount, events.length)} of {events.length} events</span>
            <div className="flex gap-2">
              {visibleCount > 6 && events.length > 6 && <Button variant="ghost" size="sm" onClick={() => setVisibleCount(6)}>Show less</Button>}
              {events.length > visibleCount && <Button variant="outline" size="sm" onClick={() => setVisibleCount((prev) => prev + 6)}>Show more</Button>}
            </div>
          </div>
        )}
      </Tabs>

      {/* Copy toast notification */}
      {copyToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-popover px-4 py-2.5 text-sm shadow-lg animate-fade-in">
          {copyToast}
        </div>
      )}
    </div>
  );
}
