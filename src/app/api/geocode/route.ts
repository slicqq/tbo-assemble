import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// In-memory cache for geocoded queries
const geocodeCache = new Map<string, { lat: number; lng: number; displayName: string }>();

// Fallback known destinations for common defaults
const KNOWN_DESTINATIONS: Record<string, { lat: number; lng: number }> = {
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  goa: { lat: 15.2993, lng: 74.124 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.209 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  kerala: { lat: 10.8505, lng: 76.2711 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  bangkok: { lat: 13.7563, lng: 100.5018 },
  bali: { lat: -8.4095, lng: 115.1889 },
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required." },
      { status: 400 }
    );
  }

  const cacheKey = query.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return NextResponse.json({
      ...geocodeCache.get(cacheKey)!,
      source: "cache",
    });
  }

  // Helper to query Nominatim with timeout and required User-Agent
  async function queryNominatim(searchStr: string) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchStr
      )}&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "TBO-Assemble-App/1.0 (contact@tboassemble.local)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name as string,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // 1. Try full venue + location query
  let result = await queryNominatim(query);

  // 2. If full string failed, and query contains commas, try fallback to secondary location parts
  if (!result && query.includes(",")) {
    const parts = query.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      // Try city/state part (skipping specific hotel name if it was obscure)
      const locationFallback = parts.slice(1).join(", ");
      result = await queryNominatim(locationFallback);
    }
  }

  // 3. If still nothing found, check if query contains any known destinations
  if (!result) {
    for (const [key, coords] of Object.entries(KNOWN_DESTINATIONS)) {
      if (cacheKey.includes(key)) {
        result = {
          lat: coords.lat,
          lng: coords.lng,
          displayName: `${query} (approximate coordinates)`,
        };
        break;
      }
    }
  }

  // 4. Default fallback if all fails: Central Bengaluru default coordinates
  if (!result) {
    result = {
      lat: 12.9716,
      lng: 77.5946,
      displayName: query,
    };
  }

  // Cache and return
  geocodeCache.set(cacheKey, result);
  return NextResponse.json({
    ...result,
    source: "nominatim",
  });
}
