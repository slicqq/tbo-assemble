"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCw, AlertTriangle } from "lucide-react";
import { Illustration } from "@/components/ui/illustration";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#ffffff] dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-5 w-24">
          <Illustration name="toolbox" className="rounded-lg" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          An unexpected error occurred. Our team has been notified. Please try again or go back to the dashboard.
        </p>

        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground mb-4">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-all"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 rounded-md border shadow-xs bg-card text-foreground font-medium text-sm hover:bg-accent hover:bg-accent transition-all"
          >
            <Home className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
