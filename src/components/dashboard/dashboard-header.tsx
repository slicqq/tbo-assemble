"use client";
import { useAuth } from "@/lib/auth-context";

export function DashboardHeader() {
  const { user } = useAuth();
  return <div className="relative mb-6 flex items-start justify-between gap-4 sm:items-center">
    <div className="min-w-0"><h1 className="text-[2rem] font-bold leading-tight">Dashboard</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">Manage your group travel events and track performance</p></div>
    <div className="hidden text-sm text-muted-foreground xl:block">Welcome back, <span className="font-semibold text-foreground">{user?.name?.split(" ")[0] || "User"}</span></div>
  </div>;
}
