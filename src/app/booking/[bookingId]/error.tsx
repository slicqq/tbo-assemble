"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, AlertTriangle, Home } from "lucide-react";
import { Illustration } from "@/components/ui/illustration";

export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Booking error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#ffffff] dark:bg-zinc-950">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-5 w-24">
          <Illustration name="toolbox" className="rounded-lg" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Booking Error</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Something went wrong loading your booking. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-all">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            <Home className="h-4 w-4" /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
