"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  LockKeyhole,
  CalendarPlus,
  Hotel,
  Users,
  GripVertical,
  AlertTriangle,
  Sparkles,
  LogOut,
  HelpCircle,
  Menu,
  X,
  Calendar,
  BarChart3,
  QrCode,
  Activity,
  MessageSquare,
  ArrowLeft,
  RotateCcw,
  FileText,
  CalendarDays,
  BedDouble,
  Calculator,
  Plane,
  ShieldAlert,
  FlaskConical,
  Database,
  Ticket,
  PackageSearch,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Overview & analytics", shortcut: "Alt+D" },
  { name: "Create Event (shared)", href: "/dashboard/onboarding", icon: Sparkles, description: "Create an event in the shared legacy workspace", shortcut: "Alt+N" },
  { name: "My Private Drafts", href: "/secure-account", icon: LockKeyhole, description: "Your account’s private basic event drafts" },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar, description: "Event calendar", shortcut: "Alt+K" },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3, description: "Compare events", shortcut: "Alt+A" },
  { name: "Inventory Decisions", href: "/inventory", icon: PackageSearch, description: "Demand, procurement opportunities and budget planning" },
  { name: "Flight Predictions", href: "/dashboard/flight-predictions", icon: Plane, description: "Flight demand and fare predictions" },
  { name: "Fare Forecast", href: "/dashboard/fare-forecast", icon: Ticket, description: "Seven-day fare estimate and price history" },
  { name: "Hotel Demand", href: "/dashboard/hotel-demand", icon: Hotel, description: "Historical hotel booking demand forecasts" },
  { name: "India Travel Data", href: "/dashboard/india-market", icon: Database, description: "Indian route traffic and collected fare observations" },
  { name: "Travel Prediction Lab", href: "/dashboard/travel-prediction", icon: FlaskConical, description: "Public-data research and historical forecasts" },
  { name: "Cancellation & Risk", href: "/dashboard/cancellation-risk", icon: ShieldAlert, description: "Cancellation assumptions and unsold inventory risk" },
];

const eventNavigation = [
  { name: "Overview", href: "", icon: CalendarPlus, description: "Event summary & stats" },
  { name: "Schedule", href: "/schedule", icon: CalendarDays, description: "Day-wise agenda & costing" },
  { name: "Inventory", href: "/inventory", icon: Hotel, description: "Room blocks & availability" },
  { name: "Guests", href: "/guests", icon: Users, description: "Guest list & import" },
  { name: "Room Assign", href: "/rooms", icon: BedDouble, description: "Multi-guest per room" },
  { name: "Allocator", href: "/allocator", icon: GripVertical, description: "Smart floor planning" },
  { name: "Pax & Quotes", href: "/pax", icon: Calculator, description: "Dynamic pricing & PDF" },
  { name: "RFP Dashboard", href: "/rfp", icon: FileText, description: "Compare vendor quotes" },
  { name: "Attrition", href: "/attrition", icon: AlertTriangle, description: "Yield protection rules" },
  { name: "Check-In", href: "/checkin", icon: QrCode, description: "QR scanner & bulk check-in" },
  { name: "Activity", href: "/activity", icon: Activity, description: "Full audit trail" },
  { name: "Feedback", href: "/feedback", icon: MessageSquare, description: "Guest reviews & sentiment" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  // Auto-detect eventId from URL path (e.g., /dashboard/events/abc123/...)
  const eventIdMatch = pathname.match(/\/dashboard\/events\/([^/]+)/);
  const eventId = eventIdMatch ? eventIdMatch[1] : undefined;

  // Demo reset handler
  const handleDemoReset = async () => {
    if (!confirm("Reset all demo data? This will restore the sample events, guests, and bookings.")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        alert("Failed to reset demo data");
      }
    } catch {
      alert("Failed to reset demo data");
    } finally {
      setResetting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger with Ctrl/Cmd key and not in input fields
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
      if (!e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      
      switch (e.key.toLowerCase()) {
        case "d":
          e.preventDefault();
          router.push("/dashboard");
          break;
        case "n":
          e.preventDefault();
          router.push("/dashboard/onboarding");
          break;
        case "k":
          e.preventDefault();
          router.push("/dashboard/calendar");
          break;
        case "a":
          if (!e.shiftKey) {
            e.preventDefault();
            router.push("/dashboard/analytics");
          }
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const itemCls = (active: boolean) =>
    cn(
      "group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      active
        ? "bg-sidebar-accent font-semibold text-foreground before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand"
        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
    );

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="size-9 shrink-0" />
        <div className="min-w-0 leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">TBO Assemble</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Group Travel OS</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-label="Main navigation">
        {eventId && (
          <Link href="/dashboard" className="mb-4 flex h-8 items-center gap-2 rounded-full px-2 text-sm text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        )}

        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Workspace</p>
        <ul className="space-y-1">
          {navigation.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  title={item.description}
                  className={itemCls(isActive)}
                >
                  <item.icon className="size-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.shortcut && (
                    <kbd className="hidden rounded border bg-background px-1 font-mono text-[10px] text-muted-foreground lg:inline-block">
                      {item.shortcut.replace("Alt+", "⌥")}
                    </kbd>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Travel intelligence</p>
        <ul className="space-y-1">
          {navigation.slice(5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link href={item.href} onClick={() => setMobileOpen(false)} aria-current={isActive ? "page" : undefined} title={item.description} className={itemCls(isActive)}>
                  <item.icon className="size-[18px] shrink-0" />
                  <span className="min-w-0 flex-1">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {eventId && (
          <>
            <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Event</p>
            <ul className="space-y-0.5">
              {eventNavigation.map((item) => {
                const href = `/dashboard/events/${eventId}${item.href}`;
                const isActive = pathname === href;
                return (
                  <li key={item.name}>
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      title={item.description}
                      className={itemCls(isActive)}
                    >
                      <item.icon className="size-[18px] shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* User */}
      <div className="shrink-0 border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2.5 rounded-md px-1 py-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-semibold text-white">
            {user?.name ? user.name.split(" ").map(n => n[0]).join("") : "U"}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user?.name || "Demo workspace"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.role || "Public demo"}</p>
          </div>
          <div className="flex items-center">
            {(user ? [
              { label: "Keyboard shortcuts (?)", icon: HelpCircle, onClick: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" })), spin: false },
              { label: "Reset Demo Data", icon: RotateCcw, onClick: handleDemoReset, spin: resetting },
              { label: "Sign out", icon: LogOut, onClick: async () => { await logout(); router.push("/login"); }, spin: false },
            ] : []).map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                disabled={a.label === "Reset Demo Data" && resetting}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground disabled:opacity-50"
                title={a.label}
                aria-label={a.label}
              >
                <a.icon className={cn("size-3.5", a.spin && "animate-spin")} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Compact, persistent mobile navigation bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-[calc(3.75rem+env(safe-area-inset-top))] items-center gap-3 border-b border-sidebar-border bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background shadow-xs"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
        >
          <Menu className="size-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="size-7" />
        <span className="text-sm font-semibold tracking-tight">TBO Assemble</span>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        id="mobile-navigation"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(19rem,85vw)] flex-col border-r border-sidebar-border bg-sidebar shadow-xl transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 flex size-11 items-center justify-center rounded-md hover:bg-sidebar-accent"
          aria-label="Close navigation menu"
        >
          <X className="size-4 text-muted-foreground" />
        </button>
        {sidebarContent}
      </aside>

      <aside className="hidden h-dvh w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex" data-tour="sidebar">
        {sidebarContent}
      </aside>
    </>
  );
}
