"use client";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function DashboardHeader() {
  const { user } = useAuth();
  return <div className="relative mb-6 flex items-start justify-between gap-4 sm:items-center">
    <div className="min-w-0"><h1 className="text-[2rem] font-bold leading-tight">Dashboard</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">Manage your group travel events and track performance</p></div>
    <div className="hidden text-sm text-muted-foreground xl:block">Welcome back, <span className="font-semibold text-foreground">{user?.name?.split(" ")[0] || "User"}</span></div>
  </div>;
}

export function InventoryDecisionBanner() {
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 dark:border-orange-900 dark:bg-orange-950/30"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">TBO inventory challenge</p><p className="mt-1 font-semibold">Plan what to buy, when and within budget</p><p className="mt-1 text-sm text-muted-foreground">Explore synthetic or uploaded inventory and compare demand, allocation and downside scenarios.</p></div><Link href="/inventory" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background">Open inventory decisions <ArrowRight className="size-4" /></Link></div>;
}
