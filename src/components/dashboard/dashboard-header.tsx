"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Bell, X, AlertTriangle, CheckCircle2, Users, Calendar, TrendingUp } from "lucide-react";

const NOTIFICATIONS = [
  { id: 1, type: "warning", icon: AlertTriangle, title: "Attrition deadline approaching", desc: "Royal Rajputana Wedding — 5 rooms at risk. Deadline in 2 days.", time: "2 min ago", unread: true },
  { id: 2, type: "success", icon: CheckCircle2, title: "3 new bookings confirmed", desc: "Grand Hyatt Conference received 3 new guest confirmations.", time: "15 min ago", unread: true },
  { id: 3, type: "info", icon: Users, title: "Guest check-in complete", desc: "Vikram Mehta checked in at Royal Rajputana Wedding.", time: "1 hour ago", unread: true },
  { id: 4, type: "info", icon: Calendar, title: "Event starting soon", desc: "Grand Hyatt Annual Conference starts in 3 days.", time: "3 hours ago", unread: false },
  { id: 5, type: "success", icon: TrendingUp, title: "Revenue milestone reached", desc: "Royal Rajputana Wedding crossed ₹15,00,000 in bookings.", time: "Yesterday", unread: false },
];

const COLLAB_USERS = [
  { name: "Priya S", color: "from-neutral-700 to-neutral-700" },
  { name: "Arjun M", color: "from-neutral-500 to-neutral-500" },
];

export function DashboardHeader() {
  const { user } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [collabCount] = useState(3);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener("mousedown", handler);
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotif(false);
    };
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, []);

  return (
    <div className="relative mb-6 flex items-start justify-between gap-4 sm:items-center">
      <div className="pl-12 lg:pl-0">
        <h1 className="text-[2rem] font-bold leading-tight">Dashboard</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Manage your group travel events and track performance
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* Live Collaboration Indicator */}
        <div className="hidden h-9 items-center gap-2 rounded-md border px-2.5 md:flex" title="Demo collaborators">
          <div className="flex -space-x-2">
            {COLLAB_USERS.slice(0, collabCount).map((u) => (
              <div key={u.name} className={`flex size-5 items-center justify-center rounded-full bg-gradient-to-br ${u.color} text-[9px] font-semibold text-white ring-2 ring-background`}>
                {u.name[0]}
              </div>
            ))}
          </div>
          <span className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{collabCount}</span> online</span>
        </div>

        {/* Live Status */}
        <div className="hidden h-9 items-center gap-2 rounded-md border px-2.5 sm:flex">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium">Live</span>
        </div>

        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Notifications"
            aria-expanded={showNotif}
            aria-haspopup="true"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-orange-600 text-[9px] font-semibold text-white ring-2 ring-background" aria-live="polite">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotif && (
            <div className="absolute right-0 sm:right-0 top-12 w-[calc(100vw-2rem)] sm:w-80 md:w-96 max-w-sm rounded-lg border bg-popover shadow-lg z-50 overflow-hidden animate-fade-in" role="dialog" aria-label="Notifications">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotif(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Close notifications"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 divide-y overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${n.unread ? "bg-muted/40" : ""}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${n.type === "warning" ? "text-amber-600" : n.type === "success" ? "text-emerald-600" : "text-blue-600"}`}>
                      <n.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {n.title}
                        {n.unread && <span className="size-1.5 rounded-full bg-orange-600" />}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.desc}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t bg-muted/40 px-4 py-2.5">
                <p className="text-center text-xs text-muted-foreground">{unreadCount === 0 ? "All caught up" : `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`}</p>
              </div>
            </div>
          )}
        </div>

        {/* Welcome */}
        <div className="hidden pl-2 text-sm text-muted-foreground xl:block">
          Welcome back, <span className="font-semibold text-foreground">{user?.name?.split(" ")[0] || "User"}</span>
        </div>
      </div>
    </div>
  );
}
