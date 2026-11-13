"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw, AlertTriangle } from "lucide-react";
import { Illustration } from "@/components/ui/illustration";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-5 w-24">
          <Illustration name="toolbox" className="rounded-lg" />
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2">
          Dashboard Error
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Something went wrong loading this page. This might be a temporary issue — try refreshing.
        </p>

        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground mb-4">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-all"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-card text-foreground text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <Home className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
