"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Illustration } from "@/components/ui/illustration";

export default function EventDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Event detail error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-5 w-24">
          <Illustration name="toolbox" className="rounded-lg" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1.5">
          Failed to load event
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          {error.message || "An error occurred while loading this event."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-all"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );
}
