"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import type { VenueMapProps } from "./venue-map-inner";

// Skeleton preview card matching 180px x 64px aesthetic while Leaflet bundle loads client-side
function VenueMapSkeleton() {
  return (
    <div className="h-[64px] w-[180px] shrink-0 rounded-xl border border-border bg-card/60 shadow-xs flex items-center justify-center gap-2 text-xs text-muted-foreground select-none">
      <div className="flex items-center gap-1.5 animate-pulse">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span>Loading map...</span>
      </div>
    </div>
  );
}

// Dynamically import Leaflet components with ssr: false to prevent "window is not defined" errors in Next.js
const DynamicVenueMap = dynamic(() => import("./venue-map-inner"), {
  ssr: false,
  loading: () => <VenueMapSkeleton />,
});

export function VenueMapPreview(props: VenueMapProps) {
  return <DynamicVenueMap {...props} />;
}
